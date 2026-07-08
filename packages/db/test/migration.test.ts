/**
 * Runs migrations/0001_init.sql against a REAL Postgres (PGlite = Postgres-in-WASM)
 * and exercises the credit-ledger + daily-quota RPCs. This verifies the actual SQL —
 * schema validity, ledger math, quota enforcement — without needing a hosted Supabase.
 *
 * Supabase-specific surface is stubbed minimally:
 *   - auth schema + auth.users table (FK target)
 *   - auth.uid() reads a GUC so we can simulate different signed-in users
 *   - authenticated/anon roles (targets of the REVOKE in the migration)
 *   - vault (not needed here; user_api_keys.secret_id is a plain uuid column)
 *
 * Run: pnpm --filter @cs/db test:migration
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(__dirname, "../migrations");
const migration = readFileSync(path.join(migDir, "0001_init.sql"), "utf8");
const migration2 = readFileSync(path.join(migDir, "0002_profile_bootstrap.sql"), "utf8");
const migration3 = readFileSync(path.join(migDir, "0003_refund_rpc.sql"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

const db = new PGlite();

// ---- Supabase-compatible bootstrap ----
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'
  );
  -- auth.uid() reads a session GUC so tests can switch the "current user"
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.uid', true), '')::uuid
  $$;
  do $$ begin
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then
      create role service_role bypassrls;
    end if;
  end $$;
`);

async function actAs(uid: string) {
  await db.exec(`set app.uid = '${uid}';`);
}
async function scalar<T = unknown>(sql: string): Promise<T> {
  const r = await db.query<{ v: T }>(sql);
  return r.rows[0]?.v as T;
}
/** Runs sql AS a given Postgres role, so RLS is actually enforced (not bypassed
 * by table ownership) — mirrors PostgREST, which always connects as anon or
 * authenticated, never as the owning/superuser role. */
async function asRole<T = unknown>(role: string, sql: string): Promise<{ ok: true; v: T } | { ok: false; error: string }> {
  try {
    await db.exec(`set role ${role};`);
    const r = await db.query<{ v: T }>(sql);
    return { ok: true, v: r.rows[0]?.v as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await db.exec(`reset role;`);
  }
}

// Supabase grants broad table-level SQL privileges to anon/authenticated/service_role
// automatically at project creation, BEFORE any user migration runs, via standing
// ALTER DEFAULT PRIVILEGES rules (so tables/functions created later — i.e. by our
// migrations — inherit the grant automatically, no re-granting needed). RLS
// policies are the fine-grained gate layered on top. Replicating the real
// ordering matters: PGlite previously ran everything as an unrestricted owner
// role, which is exactly how the refund-RLS bug (missing INSERT policy on
// credit_transactions) went undetected locally — this baseline must run FIRST so
// a migration's own REVOKE (0001's append-only guard) correctly applies on top
// of it, not get silently undone by a later grant.
await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

// ---- Apply the real migrations (in order) ----
try {
  await db.exec(migration);
  await db.exec(migration2);
  await db.exec(migration3);
  check("migrations 0001 + 0002 + 0003 apply cleanly against real Postgres", true);
} catch (e) {
  check(`migrations apply cleanly — ERROR: ${(e as Error).message}`, false);
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(1);
}

// ---- Signup trigger (0002): auto-provision profile + initial monthly grant ----
console.log("\n== signup trigger auto-provisions profile + credits ==");
const USER_C = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
  values ('${USER_C}', 'new@shop.co', '{"name":"ร้านใหม่"}')`);
check("profile row auto-created on signup",
  (await scalar<number>(`select count(*)::int as v from profiles where id='${USER_C}'`)) === 1);
check("display_name pulled from user metadata",
  (await scalar<string>(`select display_name as v from profiles where id='${USER_C}'`)) === "ร้านใหม่");
check("new user granted 20 monthly credits",
  (await scalar<number>(`select coalesce(sum(amount),0)::int as v from credit_transactions where user_id='${USER_C}' and bucket='monthly'`)) === 20);

// grant_monthly_credits is idempotent within a month
await db.exec(`select grant_monthly_credits('${USER_C}', 'free')`);
check("monthly grant idempotent (still 20, not 40)",
  (await scalar<number>(`select coalesce(sum(amount),0)::int as v from credit_transactions where user_id='${USER_C}' and bucket='monthly'`)) === 20);

// Seed the two ledger-test users via signup, then reset their auto-granted credits
// so the controlled ledger math below starts from a known-empty balance.
await db.exec(`
  insert into auth.users (id, email) values ('${USER_A}', 'a@x.co'), ('${USER_B}', 'b@x.co');
  update profiles set plan = 'pro' where id = '${USER_A}';
  delete from credit_transactions where user_id in ('${USER_A}', '${USER_B}');
`);

// ---- model_costs seeded by migration ----
console.log("\n== model_costs seeded ==");
check("image_standard = 1 credit",
  (await scalar<number>(`select credits as v from model_costs where key = 'image_standard'`)) === 1);
check("image_pro = 5 credits",
  (await scalar<number>(`select credits as v from model_costs where key = 'image_pro'`)) === 5);
check("video_minute = 2 credits",
  (await scalar<number>(`select credits as v from model_costs where key = 'video_minute'`)) === 2);

// ---- try_consume_daily_use enforces the daily limit ----
console.log("\n== try_consume_daily_use (limit 3) ==");
await actAs(USER_A);
const r1 = await scalar<number>(`select try_consume_daily_use('content_studio', 3) as v`);
const r2 = await scalar<number>(`select try_consume_daily_use('content_studio', 3) as v`);
const r3 = await scalar<number>(`select try_consume_daily_use('content_studio', 3) as v`);
const r4 = await scalar<number>(`select try_consume_daily_use('content_studio', 3) as v`);
check("1st use returns 2 remaining", r1 === 2);
check("2nd use returns 1 remaining", r2 === 1);
check("3rd use returns 0 remaining", r3 === 0);
check("4th use over limit returns -1", r4 === -1);
check("count row capped at 3 (no over-increment)",
  (await scalar<number>(`select count as v from daily_usage where user_id='${USER_A}' and tool='content_studio'`)) === 3);
// separate tool has its own counter
const otherTool = await scalar<number>(`select try_consume_daily_use('image_studio', 3) as v`);
check("different tool has independent counter", otherTool === 2);

// ---- debit_credits: monthly-first spend order, insufficient handling ----
console.log("\n== debit_credits (bucket order + insufficiency) ==");
await actAs(USER_B);
// grant 5 monthly + 10 purchased
await db.exec(`
  insert into credit_transactions (user_id, amount, kind, bucket) values
    ('${USER_B}', 5, 'monthly_grant', 'monthly'),
    ('${USER_B}', 10, 'purchase', 'purchased');
`);
const balStart = await scalar<number>(`select coalesce(sum(amount),0) as v from credit_transactions where user_id='${USER_B}'`);
check("starting balance = 15", balStart === 15);

// spend 7: should take 5 from monthly, 2 from purchased
const afterDebit = await scalar<number>(`select debit_credits(7, 'test spend', 'generation', null) as v`);
check("debit 7 returns new balance 8", afterDebit === 8);
const monthlyBal = await scalar<number>(`select coalesce(sum(amount),0) as v from credit_transactions where user_id='${USER_B}' and bucket='monthly'`);
const purchasedBal = await scalar<number>(`select coalesce(sum(amount),0) as v from credit_transactions where user_id='${USER_B}' and bucket='purchased'`);
check("monthly fully drained first (0 left)", monthlyBal === 0);
check("purchased reduced by remainder (8 left)", purchasedBal === 8);

// insufficient: try to spend 100
const insufficient = await scalar<number>(`select debit_credits(100, 'too much', 'generation', null) as v`);
check("over-balance debit returns -1", insufficient === -1);
const balUnchanged = await scalar<number>(`select coalesce(sum(amount),0) as v from credit_transactions where user_id='${USER_B}'`);
check("balance unchanged after failed debit (still 8)", balUnchanged === 8);

// ---- refund_credits RPC (0003) — regression test for the live bug where a plain
// authenticated-role insert into credit_transactions silently failed under RLS,
// so a failed generation debited credits and never gave them back ----
console.log("\n== refund_credits RPC (regression: RLS blocks raw insert, RPC bypasses correctly) ==");
const rawInsertAsAuth = await asRole(
  "authenticated",
  `insert into credit_transactions (user_id, amount, kind, bucket, note) values ('${USER_B}', 7, 'refund', 'purchased', 'raw insert attempt') returning 1 as v`
);
check(
  "raw INSERT as authenticated role is rejected by RLS (this is the exact bug — no INSERT policy exists)",
  rawInsertAsAuth.ok === false
);
const rpcRefundAsAuth = await asRole("authenticated", `select refund_credits(7, 'gen failed', 'image_studio', null) as v`);
check("refund_credits RPC succeeds as authenticated (SECURITY DEFINER bypasses the gap)", rpcRefundAsAuth.ok === true);
check(
  "refund restores balance to 15",
  (await scalar<number>(`select coalesce(sum(amount),0) as v from credit_transactions where user_id='${USER_B}'`)) === 15
);

// ---- ledger is append-only for clients (REVOKE applied) ----
console.log("\n== ledger append-only guard ==");
const revoked = await scalar<boolean>(`
  select not has_table_privilege('authenticated', 'credit_transactions', 'UPDATE') as v
`);
check("authenticated role cannot UPDATE credit_transactions", revoked === true);

// ---- increment_template_usage ----
console.log("\n== increment_template_usage ==");
await db.exec(`insert into templates (slug, kind, name_th, category, form, master_prompt, is_published)
  values ('roastmaster-pro', 'viral', 'RoastMaster', 'คลิป 3D', '[]', 'x', true)`);
await db.exec(`select increment_template_usage('roastmaster-pro')`);
await db.exec(`select increment_template_usage('roastmaster-pro')`);
check("usage_count incremented to 2",
  (await scalar<number>(`select usage_count as v from templates where slug='roastmaster-pro'`)) === 2);

// ---- RLS policies exist on core owner tables ----
console.log("\n== RLS present on owner tables ==");
for (const t of ["generations", "credit_transactions", "projects", "brands", "profiles"]) {
  const hasRls = await scalar<boolean>(`select relrowsecurity as v from pg_class where relname='${t}'`);
  check(`${t} has RLS enabled`, hasRls === true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
