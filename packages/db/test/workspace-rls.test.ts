/**
 * M9 GATE (docs/07-work-crm.md §9). Applies migrations 0001–0005 against a REAL
 * Postgres (PGlite) and proves the membership-RLS spine is airtight BEFORE any
 * Work/CRM table is built on top of it. This is the "user B cannot read user A's
 * workspace rows" test that gates the whole module — mirrors doc-01 M0.
 *
 * The critical trick (same as migration.test.ts): reads run AS the `authenticated`
 * role via asAuthUser(), so RLS is actually enforced. Running as the owner role
 * bypasses RLS and would give a false green — that's exactly how the M3 refund-RLS
 * bug hid locally.
 *
 * Run: pnpm --filter @cs/db test:workspace-rls
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(__dirname, "../migrations");
const mig = (n: string) => readFileSync(path.join(migDir, n), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";

const db = new PGlite();

// ---- Supabase-compatible bootstrap (mirrors migration.test.ts) ----
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.uid', true), '')::uuid
  $$;
  do $$ begin
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

async function scalar<T = unknown>(sql: string): Promise<T> {
  const r = await db.query<{ v: T }>(sql);
  return r.rows[0]?.v as T;
}
/** Set the signed-in uid, then run AS the authenticated role so RLS applies. */
async function asAuthUser<T = unknown>(
  uid: string,
  sql: string
): Promise<{ ok: true; v: T } | { ok: false; error: string }> {
  await db.exec(`set app.uid = '${uid}';`);
  try {
    await db.exec(`set role authenticated;`);
    const r = await db.query<{ v: T }>(sql);
    return { ok: true, v: r.rows[0]?.v as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await db.exec(`reset role;`);
  }
}
/** Run as owner (bypasses RLS) with a given uid — for invoking definer RPCs the
 * way PostgREST would after RLS-checking the JWT. */
async function actAs(uid: string) {
  await db.exec(`set app.uid = '${uid}';`);
}

// ---- Apply migrations 0001–0005, 0009, 0010 ----
try {
  for (const f of ["0001_init.sql", "0002_profile_bootstrap.sql", "0003_refund_rpc.sql", "0004_caption_broll_unique.sql", "0005_workspaces.sql", "0009_workspace_profiles_rls.sql", "0010_workspaces_owner_read_fix.sql", "0011_security_hardening.sql"]) {
    await db.exec(mig(f));
  }
  check("migrations 0001–0005, 0009, 0010, 0011 apply cleanly against real Postgres", true);
} catch (e) {
  check(`migrations apply cleanly — ERROR: ${(e as Error).message}`, false);
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(1);
}

// ---- Signup bootstraps a personal workspace per user (0005 trigger patch) ----
console.log("\n== signup auto-creates a personal workspace + owner membership ==");
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${USER_A}', 'a@x.co', '{"name":"เอ"}'),
  ('${USER_B}', 'b@x.co', '{"name":"บี"}'),
  ('${ADMIN}',  'admin@x.co', '{"name":"แอดมิน"}')`);
await db.exec(`update profiles set role = 'admin' where id = '${ADMIN}'`);

const wsA = await scalar<string>(`select id as v from workspaces where owner_id = '${USER_A}'`);
const wsB = await scalar<string>(`select id as v from workspaces where owner_id = '${USER_B}'`);
check("USER_A got exactly one workspace",
  (await scalar<number>(`select count(*)::int as v from workspaces where owner_id='${USER_A}'`)) === 1);
check("workspace name pulled from signup metadata",
  (await scalar<string>(`select name as v from workspaces where id='${wsA}'`)) === "เอ");
check("owner auto-added as an active 'owner' member",
  (await scalar<number>(`select count(*)::int as v from workspace_members where workspace_id='${wsA}' and user_id='${USER_A}' and role='owner' and status='active'`)) === 1);

// ---- is_ws_member / ws_role helpers ----
console.log("\n== membership helpers ==");
await actAs(USER_A);
check("is_ws_member true for own workspace", (await scalar<boolean>(`select is_ws_member('${wsA}') as v`)) === true);
check("is_ws_member false for another's workspace", (await scalar<boolean>(`select is_ws_member('${wsB}') as v`)) === false);
check("ws_role returns 'owner' for own workspace", (await scalar<string>(`select ws_role('${wsA}') as v`)) === "owner");
check("ws_role null for a workspace you're not in", (await scalar<string | null>(`select ws_role('${wsB}') as v`)) === null);

// ---- THE GATE: cross-tenant read isolation under RLS ----
console.log("\n== cross-tenant isolation (user B cannot see user A's workspace) ==");
const bSeesAWorkspace = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspaces where id='${wsA}'`);
check("B reads 0 rows of A's workspace", bSeesAWorkspace.ok && bSeesAWorkspace.v === 0);
const bSeesAMembers = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspace_members where workspace_id='${wsA}'`);
check("B reads 0 of A's membership rows", bSeesAMembers.ok && bSeesAMembers.v === 0);
const aSeesOwn = await asAuthUser<number>(USER_A, `select count(*)::int as v from workspaces where id='${wsA}'`);
check("A still reads its own workspace (policy isn't over-broad)", aSeesOwn.ok && aSeesOwn.v === 1);

// ---- Direct writes to members are denied for clients (RPC-only path) ----
console.log("\n== workspace_members is write-locked to definer RPCs ==");
const rawInsert = await asAuthUser(USER_A, `insert into workspace_members (workspace_id, user_id, role) values ('${wsA}','${USER_B}','member') returning 1 as v`);
check("raw INSERT into workspace_members as authenticated is rejected", rawInsert.ok === false);

// ---- 0009: teammate profile visibility follows membership exactly ----
console.log("\n== teammate profile reads (0009) — off before membership ==");
const bReadsAProfileBefore = await asAuthUser<number>(USER_B, `select count(*)::int as v from profiles where id='${USER_A}'`);
check("B cannot read A's profile before sharing a workspace", bReadsAProfileBefore.ok && bReadsAProfileBefore.v === 0);

// ---- add_member (owner/admin only) shares the workspace ----
console.log("\n== add_member enforces role + actually grants access ==");
const addByOutsider = await asAuthUser(USER_B, `select add_member('${wsA}','${ADMIN}','member') as v`);
check("non-member cannot add_member (raises)", addByOutsider.ok === false);
await actAs(USER_A);
await db.exec(`select add_member('${wsA}', '${USER_B}', 'member')`);
await actAs(USER_B);
check("is_ws_member true for B after add", (await scalar<boolean>(`select is_ws_member('${wsA}') as v`)) === true);
const bNowSeesA = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspaces where id='${wsA}'`);
check("B now reads A's workspace (exactly members, no more no less)", bNowSeesA.ok && bNowSeesA.v === 1);
const bReadsAProfileAfterAdd = await asAuthUser<number>(USER_B, `select count(*)::int as v from profiles where id='${USER_A}'`);
check("B can read A's profile once they share a workspace", bReadsAProfileAfterAdd.ok && bReadsAProfileAfterAdd.v === 1);
const adminReadsAProfile = await asAuthUser<number>(ADMIN, `select count(*)::int as v from profiles where id='${USER_A}'`);
check("ADMIN (not a member of wsA) still cannot read A's profile", adminReadsAProfile.ok && adminReadsAProfile.v === 0);

// ---- remove_member soft-removes and flips access off immediately ----
console.log("\n== remove_member revokes access; owner is protected ==");
await actAs(USER_A);
const removeOwner = await asAuthUser(USER_A, `select remove_member('${wsA}','${USER_A}') as v`);
check("cannot remove the owner (raises)", removeOwner.ok === false);
await db.exec(`select remove_member('${wsA}', '${USER_B}')`);
const bAfterRemoval = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspaces where id='${wsA}'`);
check("removed member reads 0 of A's workspace again", bAfterRemoval.ok && bAfterRemoval.v === 0);
const bReadsAProfileAfterRemoval = await asAuthUser<number>(USER_B, `select count(*)::int as v from profiles where id='${USER_A}'`);
check("B loses profile read on A immediately after removal", bReadsAProfileAfterRemoval.ok && bReadsAProfileAfterRemoval.v === 0);

// ---- Entitlement: admin-only grant, and ws_has_feature honors expiry ----
console.log("\n== work_crm entitlement (admin grants; expiry honored) ==");
check("feature absent before any grant", (await scalar<boolean>(`select ws_has_feature('${wsA}','work_crm') as v`)) === false);
const grantByNonAdmin = await asAuthUser(USER_A, `select grant_feature('${wsA}','work_crm', null) as v`);
check("non-admin cannot grant_feature (raises)", grantByNonAdmin.ok === false);
await actAs(ADMIN);
await db.exec(`select grant_feature('${wsA}', 'work_crm', null)`);
check("admin grant turns the feature on", (await scalar<boolean>(`select ws_has_feature('${wsA}','work_crm') as v`)) === true);
await db.exec(`select grant_feature('${wsA}', 'work_crm', now() - interval '1 day')`);
check("expired grant reads as off", (await scalar<boolean>(`select ws_has_feature('${wsA}','work_crm') as v`)) === false);
await db.exec(`select revoke_feature('${wsA}', 'work_crm')`);
check("revoke removes the entitlement row",
  (await scalar<number>(`select count(*)::int as v from workspace_entitlements where workspace_id='${wsA}'`)) === 0);

// ---- 0011 GATE: profiles.role cannot be self-escalated ----
console.log("\n== profiles.role is locked from client writes (0011) ==");
const selfEscalate = await asAuthUser(USER_B, `update profiles set role = 'admin' where id = '${USER_B}' returning 1 as v`);
check("non-admin cannot UPDATE their own profiles.role (permission denied)", selfEscalate.ok === false);
check("USER_B's role is still 'user' after the attempt", (await scalar<string>(`select role as v from profiles where id='${USER_B}'`)) === "user");

// ---- 0011 GATE: workspace ownership cannot be hijacked via UPDATE ----
console.log("\n== workspaces.owner_id cannot be reassigned by a workspace admin, not owner (0011) ==");
await actAs(USER_A);
await db.exec(`select add_member('${wsA}', '${USER_B}', 'admin')`); // B is a workspace ADMIN of A's ws — not owner
const hijack = await asAuthUser(USER_B, `update workspaces set owner_id = '${USER_B}' where id = '${wsA}' returning 1 as v`);
check("workspace admin (not owner) cannot UPDATE owner_id (permission denied)", hijack.ok === false);
check("wsA owner_id is unchanged", (await scalar<string>(`select owner_id as v from workspaces where id='${wsA}'`)) === USER_A);
const hijackPlan = await asAuthUser(USER_B, `update workspaces set plan = 'business' where id = '${wsA}' returning 1 as v`);
check("workspace admin cannot UPDATE plan either (permission denied)", hijackPlan.ok === false);

// ---- 0011 GATE: workspace_invites read is narrowed to owner/admin ----
console.log("\n== workspace_invites read is owner/admin only (0011) ==");
await actAs(USER_A);
await db.exec(`select create_invite('${wsA}', 'someone@x.co', 'member')`);
const adminReadsInvites = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspace_invites where workspace_id='${wsA}'`);
check("workspace admin CAN read pending invites", adminReadsInvites.ok && adminReadsInvites.v === 1);
await db.exec(`select set_member_role('${wsA}', '${USER_B}', 'member')`); // demote B to plain member
const plainMemberReadsInvites = await asAuthUser<number>(USER_B, `select count(*)::int as v from workspace_invites where workspace_id='${wsA}'`);
check("plain member CANNOT read pending invites", plainMemberReadsInvites.ok && plainMemberReadsInvites.v === 0);
await actAs(USER_A); // asAuthUser(USER_B, ...) above leaves app.uid=USER_B; remove_member needs the owner
await db.exec(`select remove_member('${wsA}', '${USER_B}')`); // clean up — restore pre-0011-test state

// ---- RLS enabled on every new table ----
console.log("\n== RLS present on new tables ==");
for (const t of ["workspaces", "workspace_members", "workspace_invites", "workspace_entitlements"]) {
  check(`${t} has RLS enabled`, (await scalar<boolean>(`select relrowsecurity as v from pg_class where relname='${t}'`)) === true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
