/**
 * M10 gate (docs/07-work-crm.md §2). Applies migrations 0001–0006 against real
 * Postgres (PGlite) and proves the Work module's guarantees: the work_crm
 * entitlement actually gates access, tasks can't leak across workspaces, a task's
 * workspace must match its board's (composite FK), assignees must be members, the
 * reorder RPC is authorized + fractional, and status changes are audited.
 *
 * Reads run AS the `authenticated` role so RLS is truly enforced.
 * Run: pnpm --filter @cs/db test:work-rls
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

// ---- Apply migrations 0001–0006, 0011–0014 ----
try {
  for (const f of ["0001_init.sql", "0002_profile_bootstrap.sql", "0003_refund_rpc.sql", "0004_caption_broll_unique.sql", "0005_workspaces.sql", "0006_work.sql", "0011_security_hardening.sql", "0012_work_security_hardening.sql", "0013_reorder_task_null_status_fix.sql", "0014_task_data_integrity_checks.sql"]) {
    await db.exec(mig(f));
  }
  check("migrations 0001–0006, 0011–0014 apply cleanly against real Postgres", true);
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

// ---- Entitlement gate: no work_crm → members can't even create a board ----
console.log("\n== work_crm entitlement gates the Work tables ==");
const boardBeforeGrant = await asAuthUser(USER_A, `insert into boards (workspace_id, name) values ('${wsA}','Sprint') returning id as v`);
check("member CANNOT create a board before work_crm is granted", boardBeforeGrant.ok === false);
await actAs(ADMIN);
await db.exec(`select grant_feature('${wsA}', 'work_crm', null)`);
const boardAfterGrant = await asAuthUser<string>(USER_A, `insert into boards (workspace_id, name) values ('${wsA}','Sprint') returning id as v`);
check("member CAN create a board after work_crm is granted", boardAfterGrant.ok === true);
const boardA = boardAfterGrant.ok ? boardAfterGrant.v : "";

// add B to the workspace so we can test a legit member + assignee
await actAs(USER_A);
await db.exec(`select add_member('${wsA}', '${USER_B}', 'member')`);

// ---- Create tasks (as member A) ----
console.log("\n== task creation + assignee-must-be-member ==");
async function addTask(title: string, pos: number, assignee: string | null) {
  const a = assignee ? `'${assignee}'` : "null";
  return asAuthUser<string>(USER_A, `insert into tasks (workspace_id, board_id, title, position, assignee_id) values ('${wsA}','${boardA}','${title}',${pos},${a}) returning id as v`);
}
const t1 = await addTask("hook script", 1000, USER_A);
const t2 = await addTask("shoot b-roll", 2000, USER_B);
check("member creates a task assigned to a member", t1.ok && t2.ok);
const badAssignee = await addTask("edit", 3000, USER_C);
check("assigning a non-member is rejected by the trigger", badAssignee.ok === false);
const t3 = await addTask("edit", 3000, null);
check("task with no assignee is fine", t3.ok === true);
const task1 = t1.ok ? t1.v : "", task2 = t2.ok ? t2.v : "", task3 = t3.ok ? t3.v : "";

// ---- Cross-tenant + outsider isolation ----
console.log("\n== isolation: outsider sees nothing, member sees the board's tasks ==");
const cSeesTasks = await asAuthUser<number>(USER_C, `select count(*)::int as v from tasks where workspace_id='${wsA}'`);
check("outsider C reads 0 tasks of A's workspace", cSeesTasks.ok && cSeesTasks.v === 0);
const bSeesTasks = await asAuthUser<number>(USER_B, `select count(*)::int as v from tasks where workspace_id='${wsA}'`);
check("member B reads all 3 tasks", bSeesTasks.ok && bSeesTasks.v === 3);

// ---- Composite FK: a task's workspace must equal its board's ----
console.log("\n== board/task workspace consistency is DB-enforced ==");
const wsC = await scalar<string>(`select id as v from workspaces where owner_id = '${USER_C}'`);
await actAs(USER_A);
let fkBlocked = false;
try {
  await db.exec(`insert into tasks (workspace_id, board_id, title) values ('${wsC}','${boardA}','smuggled')`);
} catch { fkBlocked = true; }
check("task with mismatched (board, workspace) is rejected by composite FK", fkBlocked === true);

// ---- reorder_task: fractional midpoint + authorization ----
console.log("\n== reorder_task (advisory-locked, fractional) ==");
const reorder = await asAuthUser<string>(USER_A, `select reorder_task('${task3}','in_progress','${task1}','${task2}') as v`);
check("reorder returns midpoint position 1500", reorder.ok && Number(reorder.v) === 1500);
check("reorder moved task3 to status in_progress",
  (await scalar<string>(`select status as v from tasks where id='${task3}'`)) === "in_progress");
const reorderByOutsider = await asAuthUser(USER_C, `select reorder_task('${task1}','done',null,null) as v`);
check("outsider cannot reorder A's task (raises)", reorderByOutsider.ok === false);

// ---- 0013 GATE: null status is rejected cleanly, not silently accepted ----
console.log("\n== reorder_task rejects a null status (0013) ==");
const reorderNullStatus = await asAuthUser(USER_A, `select reorder_task('${task1}',null,null,null) as v`);
check("null status raises 'invalid status', not silently accepted", reorderNullStatus.ok === false);
check("task1's status is unchanged", (await scalar<string>(`select status as v from tasks where id='${task1}'`)) !== null);

// ---- Audit trail ----
console.log("\n== task_activity audit trail ==");
check("each task insert logged a 'created' activity row",
  (await scalar<number>(`select count(*)::int as v from task_activity where kind='created' and workspace_id='${wsA}'`)) === 3);
check("the reorder's status change logged a 'status' activity row",
  (await scalar<number>(`select count(*)::int as v from task_activity where kind='status' and task_id='${task3}'`)) === 1);
const rawActivityInsert = await asAuthUser(USER_A, `insert into task_activity (task_id, workspace_id, kind) values ('${task1}','${wsA}','forged') returning 1 as v`);
check("clients cannot write task_activity directly (append-only via trigger)", rawActivityInsert.ok === false);

// ---- 0012 GATE: cross-workspace smuggling blocked; ordinary edits still work ----
console.log("\n== tasks.workspace_id is locked; ordinary task edits still work (0012) ==");
const ordinaryEdit = await asAuthUser(USER_A, `update tasks set status = 'blocked', title = 'renamed' where id = '${task1}' returning 1 as v`);
check("ordinary column update (status, title) still succeeds for a member", ordinaryEdit.ok === true);
await actAs(USER_C);
await db.exec(`select add_member('${wsC}', '${USER_A}', 'member')`); // A is now ALSO a member of C's workspace
await actAs(ADMIN);
await db.exec(`select grant_feature('${wsC}', 'work_crm', null)`); // and it's entitled too
const smuggle = await asAuthUser(USER_A, `update tasks set workspace_id = '${wsC}' where id = '${task1}' returning 1 as v`);
check("member of BOTH workspaces cannot move a task's workspace_id (permission denied)", smuggle.ok === false);
check("task1 is still in wsA", (await scalar<string>(`select workspace_id as v from tasks where id='${task1}'`)) === wsA);

// ---- 0012 GATE: comment delete requires current membership + entitlement ----
console.log("\n== task_comments delete requires live membership + entitlement (0012) ==");
const comment = await asAuthUser<string>(USER_B, `insert into task_comments (task_id, workspace_id, body) values ('${task1}','${wsA}','looks good') returning id as v`);
check("member can insert a comment", comment.ok === true);
const commentId = comment.ok ? comment.v : "";
await actAs(USER_A);
await db.exec(`select remove_member('${wsA}', '${USER_B}')`); // B is removed from the workspace
const deleteAfterRemoval = await asAuthUser<number>(USER_B, `delete from task_comments where id = '${commentId}' returning 1 as v`);
// RLS filters DELETE silently (0 rows matched, not an error) — same pattern as
// campaigns-rls.test.ts's cross-user delete check.
check("removed member cannot delete their own prior comment", deleteAfterRemoval.ok && deleteAfterRemoval.v === undefined);
check("the comment row still exists", (await scalar<number>(`select count(*)::int as v from task_comments where id='${commentId}'`)) === 1);

// ---- 0014 GATE: estimate_hours / date-range integrity is DB-enforced, not just app-layer ----
console.log("\n== task data-integrity CHECK constraints (0014) ==");
const negHours = await asAuthUser(
  USER_A,
  `insert into tasks (workspace_id, board_id, title, estimate_hours) values ('${wsA}','${boardA}','neg hours', -1) returning 1 as v`
);
check("negative estimate_hours is rejected by a DB CHECK constraint", negHours.ok === false);
const invertedRange = await asAuthUser(
  USER_A,
  `insert into tasks (workspace_id, board_id, title, start_date, due_date) values ('${wsA}','${boardA}','inverted', '2026-08-15', '2026-08-01') returning 1 as v`
);
check("start_date > due_date is rejected by a DB CHECK constraint", invertedRange.ok === false);
const validTask = await asAuthUser(
  USER_A,
  `insert into tasks (workspace_id, board_id, title, estimate_hours, start_date, due_date) values ('${wsA}','${boardA}','valid', 2.5, '2026-08-01', '2026-08-15') returning 1 as v`
);
check("a valid estimate + date range still inserts fine", validTask.ok === true);
const nullsOk = await asAuthUser(
  USER_A,
  `insert into tasks (workspace_id, board_id, title) values ('${wsA}','${boardA}','no dates or estimate') returning 1 as v`
);
check("omitting estimate_hours/dates (NULL) still inserts fine", nullsOk.ok === true);
const badUpdate = await asAuthUser(
  USER_A,
  `update tasks set due_date = '2026-01-01' where id = '${task1}' returning 1 as v`
);
// task1 has no start_date set in this suite, so this specific update is just a
// smoke check that the constraint doesn't fire on a NULL start_date; the real
// inversion case is covered by validTask/invertedRange above via matched pairs.
check("editing due_date alone (no start_date set) still succeeds", badUpdate.ok === true);

// ---- RLS present ----
console.log("\n== RLS present on new tables ==");
for (const t of ["boards", "tasks", "task_comments", "task_activity"]) {
  check(`${t} has RLS enabled`, (await scalar<boolean>(`select relrowsecurity as v from pg_class where relname='${t}'`)) === true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
