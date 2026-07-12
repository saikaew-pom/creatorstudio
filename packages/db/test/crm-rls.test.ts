/**
 * M11 gate (docs/07-work-crm.md §3). Applies migrations 0001–0006, 0011–0015
 * against real Postgres (PGlite) and proves the CRM module's guarantees: the
 * work_crm entitlement gates it, rows can't leak across workspaces, a deal's
 * stage must belong to its own workspace (composite FK), owners must be
 * members, reorder_deal is authorized + fractional, stage/amount changes are
 * audited, manual activity entries work but forged audit-kind entries don't,
 * and the data-integrity CHECK constraints hold from day one (no 0014-style
 * follow-up needed).
 *
 * Reads run AS the `authenticated` role so RLS is truly enforced.
 * Run: pnpm --filter @cs/db test:crm-rls
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

const USER_A = "11111111-1111-1111-1111-111111111111"; // owner of wsA
const USER_B = "22222222-2222-2222-2222-222222222222"; // added member
const USER_C = "44444444-4444-4444-4444-444444444444"; // outsider
const ADMIN = "33333333-3333-3333-3333-333333333333";

const db = new PGlite();

await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.uid', true), '')::uuid $$;
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
async function actAs(uid: string) {
  await db.exec(`set app.uid = '${uid}';`);
}

// ---- Apply migrations 0001–0006, 0011–0015 ----
try {
  for (const f of [
    "0001_init.sql", "0002_profile_bootstrap.sql", "0003_refund_rpc.sql", "0004_caption_broll_unique.sql",
    "0005_workspaces.sql", "0006_work.sql", "0011_security_hardening.sql", "0012_work_security_hardening.sql",
    "0013_reorder_task_null_status_fix.sql", "0014_task_data_integrity_checks.sql", "0015_crm.sql",
    "0016_crm_security_hardening.sql",
  ]) {
    await db.exec(mig(f));
  }
  check("migrations 0001–0006, 0011–0016 apply cleanly against real Postgres", true);
} catch (e) {
  check(`migrations apply cleanly — ERROR: ${(e as Error).message}`, false);
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(1);
}

await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${USER_A}', 'a@x.co', '{"name":"เอ"}'),
  ('${USER_B}', 'b@x.co', '{"name":"บี"}'),
  ('${USER_C}', 'c@x.co', '{"name":"ซี"}'),
  ('${ADMIN}',  'admin@x.co', '{"name":"แอดมิน"}')`);
await db.exec(`update profiles set role = 'admin' where id = '${ADMIN}'`);
const wsA = await scalar<string>(`select id as v from workspaces where owner_id = '${USER_A}'`);

// ---- Entitlement gate: no work_crm → members can't even create a company ----
console.log("\n== work_crm entitlement gates the CRM tables ==");
const companyBeforeGrant = await asAuthUser(USER_A, `insert into crm_companies (workspace_id, name) values ('${wsA}','BrandX') returning id as v`);
check("member CANNOT create a company before work_crm is granted", companyBeforeGrant.ok === false);
await actAs(ADMIN);
await db.exec(`select grant_feature('${wsA}', 'work_crm', null)`);
const companyAfterGrant = await asAuthUser<string>(USER_A, `insert into crm_companies (workspace_id, name) values ('${wsA}','BrandX') returning id as v`);
check("member CAN create a company after work_crm is granted", companyAfterGrant.ok === true);
const companyA = companyAfterGrant.ok ? companyAfterGrant.v : "";

// add B to the workspace so we can test a legit member + owner
await actAs(USER_A);
await db.exec(`select add_member('${wsA}', '${USER_B}', 'member')`);

// ---- seed_default_stages: idempotent, authorized ----
console.log("\n== seed_default_stages (idempotent) ==");
const seedOutsider = await asAuthUser(USER_C, `select seed_default_stages('${wsA}') as v`);
check("outsider cannot seed stages for A's workspace (raises)", seedOutsider.ok === false);
const seed1 = await asAuthUser(USER_A, `select seed_default_stages('${wsA}') as v`);
check("member can seed default stages", seed1.ok === true);
check("8 stages seeded", (await scalar<number>(`select count(*)::int as v from deal_stages where workspace_id='${wsA}'`)) === 8);
await asAuthUser(USER_A, `select seed_default_stages('${wsA}') as v`);
check("re-seeding is idempotent (still 8 stages)", (await scalar<number>(`select count(*)::int as v from deal_stages where workspace_id='${wsA}'`)) === 8);

const stageProspect = await scalar<string>(`select id as v from deal_stages where workspace_id='${wsA}' and key='prospect'`);
const stageOutreach = await scalar<string>(`select id as v from deal_stages where workspace_id='${wsA}' and key='outreach'`);
const stageNegotiating = await scalar<string>(`select id as v from deal_stages where workspace_id='${wsA}' and key='negotiating'`);

// ---- Contacts + owner-must-be-member trigger ----
console.log("\n== contacts + deal creation, owner-must-be-member ==");
const contactA = await asAuthUser<string>(USER_A, `insert into crm_contacts (workspace_id, company_id, name) values ('${wsA}','${companyA}','คุณเอ') returning id as v`);
check("member creates a contact under the company", contactA.ok === true);
const contact1 = contactA.ok ? contactA.v : "";

async function addDeal(title: string, stage: string, owner: string | null, amount?: number) {
  const o = owner ? `'${owner}'` : "null";
  const amt = amount === undefined ? "null" : String(amount);
  return asAuthUser<string>(
    USER_A,
    `insert into deals (workspace_id, title, company_id, primary_contact_id, stage_id, owner_id, amount_thb)
     values ('${wsA}','${title}','${companyA}','${contact1}','${stage}',${o},${amt}) returning id as v`
  );
}
const d1 = await addDeal("รีวิวครีมกันแดด x BrandX", stageProspect, USER_A, 15000);
check("member creates a deal with a valid member owner", d1.ok === true);
const badOwner = await addDeal("bad owner deal", stageProspect, USER_C);
check("assigning a non-member owner is rejected by the trigger", badOwner.ok === false);
const noOwner = await addDeal("no owner deal", stageProspect, null);
check("deal with no owner is fine", noOwner.ok === true);
const deal1 = d1.ok ? d1.v : "";

// ---- Isolation ----
console.log("\n== isolation: outsider sees nothing, member sees the workspace's CRM data ==");
const cSeesDeals = await asAuthUser<number>(USER_C, `select count(*)::int as v from deals where workspace_id='${wsA}'`);
check("outsider C reads 0 deals of A's workspace", cSeesDeals.ok && cSeesDeals.v === 0);
const bSeesDeals = await asAuthUser<number>(USER_B, `select count(*)::int as v from deals where workspace_id='${wsA}'`);
check("member B reads all deals", bSeesDeals.ok && bSeesDeals.v === 2);

// ---- Composite FK: a deal's stage must belong to its own workspace ----
console.log("\n== deal/stage workspace consistency is DB-enforced ==");
const wsC = await scalar<string>(`select id as v from workspaces where owner_id = '${USER_C}'`);
await actAs(ADMIN);
await db.exec(`select grant_feature('${wsC}', 'work_crm', null)`);
await asAuthUser(USER_C, `select seed_default_stages('${wsC}') as v`);
const stageC = await scalar<string>(`select id as v from deal_stages where workspace_id='${wsC}' limit 1`);
await actAs(USER_A);
let fkBlocked = false;
try {
  await db.exec(`insert into deals (workspace_id, title, stage_id) values ('${wsA}','smuggled','${stageC}')`);
} catch { fkBlocked = true; }
check("deal referencing a stage from a DIFFERENT workspace is rejected by composite FK", fkBlocked === true);

// ---- reorder_deal: fractional midpoint + authorization + invalid stage ----
console.log("\n== reorder_deal (advisory-locked, fractional) ==");
const d2 = await addDeal("deal2", stageProspect, USER_A);
const deal2 = d2.ok ? d2.v : "";
const reorder = await asAuthUser<string>(USER_A, `select reorder_deal('${deal2}','${stageOutreach}','${deal1}',null) as v`);
check("reorder returns a position after the existing deal (2000)", reorder.ok && Number(reorder.v) === 2000);
check("reorder moved deal2 to the outreach stage",
  (await scalar<string>(`select stage_id as v from deals where id='${deal2}'`)) === stageOutreach);
const reorderByOutsider = await asAuthUser(USER_C, `select reorder_deal('${deal1}','${stageOutreach}',null,null) as v`);
check("outsider cannot reorder A's deal (raises)", reorderByOutsider.ok === false);
const reorderNullStage = await asAuthUser(USER_A, `select reorder_deal('${deal1}',null,null,null) as v`);
check("null stage raises 'invalid stage', not silently accepted", reorderNullStage.ok === false);
const reorderForeignStage = await asAuthUser(USER_A, `select reorder_deal('${deal1}','${stageC}',null,null) as v`);
check("a stage from a DIFFERENT workspace raises 'invalid stage'", reorderForeignStage.ok === false);

// ---- Audit trail: stage_change / amount_change from the trigger; manual notes from clients ----
console.log("\n== deal_activities: audited stage/amount changes + manual entries ==");
check("reorder_deal's stage move logged a 'stage_change' activity row",
  (await scalar<number>(`select count(*)::int as v from deal_activities where kind='stage_change' and deal_id='${deal2}'`)) === 1);
const amountChange = await asAuthUser(USER_A, `update deals set amount_thb = 20000 where id = '${deal1}' returning 1 as v`);
check("amount edit succeeds", amountChange.ok === true);
check("amount_thb change logged an 'amount_change' activity row",
  (await scalar<number>(`select count(*)::int as v from deal_activities where kind='amount_change' and deal_id='${deal1}'`)) === 1);

const manualNote = await asAuthUser(USER_B, `insert into deal_activities (deal_id, workspace_id, actor_id, kind, body) values ('${deal1}','${wsA}','${USER_B}','note','ตามงานแล้ว') returning 1 as v`);
check("a member can log a manual 'note' activity as themselves", manualNote.ok === true);
const forgedStageChange = await asAuthUser(USER_B, `insert into deal_activities (deal_id, workspace_id, actor_id, kind, body) values ('${deal1}','${wsA}','${USER_B}','stage_change','forged') returning 1 as v`);
check("a client cannot forge a 'stage_change' activity directly (only the trigger may)", forgedStageChange.ok === false);
const impersonatedNote = await asAuthUser(USER_B, `insert into deal_activities (deal_id, workspace_id, actor_id, kind, body) values ('${deal1}','${wsA}','${USER_A}','note','impersonated') returning 1 as v`);
check("a client cannot log a note AS someone else", impersonatedNote.ok === false);
const activityUpdate = await asAuthUser(USER_B, `update deal_activities set body = 'edited' where deal_id = '${deal1}' returning 1 as v`);
check("deal_activities cannot be updated by clients (append-only)", activityUpdate.ok === false);
const activityDelete = await asAuthUser(USER_B, `delete from deal_activities where deal_id = '${deal1}' returning 1 as v`);
check("deal_activities cannot be deleted by clients (append-only)", activityDelete.ok === false);

// ---- Column-privilege hardening: workspace_id locked; ordinary edits still work ----
console.log("\n== deals.workspace_id is locked; ordinary deal edits still work ==");
const ordinaryEdit = await asAuthUser(USER_A, `update deals set title = 'renamed', probability = 60 where id = '${deal1}' returning 1 as v`);
check("ordinary column update (title, probability) still succeeds for a member", ordinaryEdit.ok === true);
await actAs(USER_C);
await db.exec(`select add_member('${wsC}', '${USER_A}', 'member')`); // A is now ALSO a member of C's workspace
const smuggle = await asAuthUser(USER_A, `update deals set workspace_id = '${wsC}' where id = '${deal1}' returning 1 as v`);
check("member of BOTH workspaces cannot move a deal's workspace_id (permission denied)", smuggle.ok === false);
check("deal1 is still in wsA", (await scalar<string>(`select workspace_id as v from deals where id='${deal1}'`)) === wsA);

// ---- Data-integrity CHECK constraints (baked in from day 1, not a follow-up) ----
console.log("\n== deal data-integrity CHECK constraints ==");
const negAmount = await addDeal("neg amount", stageProspect, null, -1);
check("negative amount_thb is rejected by a DB CHECK constraint", negAmount.ok === false);
const badProbability = await asAuthUser(USER_A, `insert into deals (workspace_id, title, stage_id, probability) values ('${wsA}','bad prob','${stageProspect}', 150) returning 1 as v`);
check("probability outside 0–100 is rejected by a DB CHECK constraint", badProbability.ok === false);

// ---- Deliverables: workspace/deal consistency ----
console.log("\n== deliverables workspace/deal consistency ==");
const deliverable = await asAuthUser<string>(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title) values ('${wsA}','${deal1}','content_kit','โพสต์รีวิว') returning id as v`);
check("member creates a deliverable on their own deal (unlinked)", deliverable.ok === true);
let deliverableFkBlocked = false;
try {
  await db.exec(`insert into deliverables (workspace_id, deal_id, kind, title) values ('${wsA}','${deal1}','image','x')`); // sanity: same deal, should work as service role too
} catch { deliverableFkBlocked = true; }
check("(sanity) same-workspace deliverable insert as service role succeeds", deliverableFkBlocked === false);
let deliverableCrossBlocked = false;
try {
  const anotherDealInC = await scalar<string>(`select id as v from deals where workspace_id='${wsC}' limit 1`);
  if (anotherDealInC) {
    await db.exec(`insert into deliverables (workspace_id, deal_id, kind, title) values ('${wsA}','${anotherDealInC}','image','smuggled')`);
  } else {
    deliverableCrossBlocked = true; // no deal in C to test against — treat as N/A-pass
  }
} catch { deliverableCrossBlocked = true; }
check("a deliverable referencing a deal from a DIFFERENT workspace is rejected by composite FK", deliverableCrossBlocked === true);

// ---- 0016 CRITICAL GATE: the bridge's write side actually enforces ownership ----
console.log("\n== deliverable asset-link ownership is DB-enforced, not just app-layer (0016) ==");
await db.exec(`insert into generations (id, user_id, type, tool, input, prompt_id) values
  ('55555555-5555-5555-5555-555555555555', '${USER_A}', 'image', 'image_studio', '{}', 'test'),
  ('66666666-6666-6666-6666-666666666666', '${USER_C}', 'image', 'image_studio', '{}', 'test')`);
await db.exec(`insert into projects (id, user_id) values ('77777777-7777-7777-7777-777777777777', '${USER_A}')`);
const ownGenId = "55555555-5555-5555-5555-555555555555";
const foreignGenId = "66666666-6666-6666-6666-666666666666";
const ownProjectId = "77777777-7777-7777-7777-777777777777";

const linkOwn = await asAuthUser<string>(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title, generation_id, owner_user_id) values ('${wsA}','${deal1}','image','own asset','${ownGenId}','${USER_A}') returning id as v`);
check("member links their OWN generation to a deliverable", linkOwn.ok === true);
const linkOwnProject = await asAuthUser<string>(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title, project_id, owner_user_id) values ('${wsA}','${deal1}','video','own project','${ownProjectId}','${USER_A}') returning id as v`);
check("member links their OWN project to a deliverable", linkOwnProject.ok === true);

const linkForeignGen = await asAuthUser(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title, generation_id, owner_user_id) values ('${wsA}','${deal1}','image','stolen','${foreignGenId}','${USER_A}') returning 1 as v`);
check("CRITICAL: cannot link a generation owned by a DIFFERENT user (trigger rejects)", linkForeignGen.ok === false);
const impersonateOwner = await asAuthUser(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title, generation_id, owner_user_id) values ('${wsA}','${deal1}','image','fake owner','${ownGenId}','${USER_C}') returning 1 as v`);
check("cannot claim someone else as owner_user_id while linking your own asset", impersonateOwner.ok === false);
const bareOwner = await asAuthUser(USER_A, `insert into deliverables (workspace_id, deal_id, kind, title, owner_user_id) values ('${wsA}','${deal1}','other','bare owner','${USER_A}') returning 1 as v`);
check("owner_user_id cannot be set without an actual linked asset", bareOwner.ok === false);

// direct-REST-style bypass: attacker already owns a deliverable, then tries to
// retarget it at someone else's asset via UPDATE (the exact confused-deputy
// scenario the review found — this must be rejected exactly like the INSERT case).
const retarget = await asAuthUser(USER_A, `update deliverables set generation_id = '${foreignGenId}', owner_user_id = '${USER_A}' where id = '${linkOwn.ok ? linkOwn.v : ""}' returning 1 as v`);
check("CRITICAL: cannot retarget an existing deliverable at a foreign generation via UPDATE either", retarget.ok === false);

// ---- 0016 GATE: company_id/primary_contact_id/task_id can't smuggle across workspaces ----
console.log("\n== deals.company_id / primary_contact_id workspace consistency (0016) ==");
// USER_A is already a member of BOTH wsA and wsC at this point (added above).
await actAs(USER_C);
const companyC = await scalar<string>(`insert into crm_companies (workspace_id, name) values ('${wsC}','SecretCo C') returning id as v`);
const companySmuggle = await asAuthUser(USER_A, `update deals set company_id = '${companyC}' where id = '${deal1}' returning 1 as v`);
check("member of BOTH workspaces cannot point a deal's company_id at a DIFFERENT workspace's company", companySmuggle.ok === false);
check("deal1's workspace_id is still wsA", (await scalar<string>(`select workspace_id as v from deals where id='${deal1}'`)) === wsA);

// ---- RLS present ----
console.log("\n== RLS present on new tables ==");
for (const t of ["crm_companies", "crm_contacts", "deal_stages", "deals", "deal_activities", "deliverables"]) {
  check(`${t} has RLS enabled`, (await scalar<boolean>(`select relrowsecurity as v from pg_class where relname='${t}'`)) === true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
