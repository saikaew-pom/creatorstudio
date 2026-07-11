/**
 * Runs migrations/0001-0004 + 0007_campaigns.sql against a REAL Postgres (PGlite)
 * and proves the campaigns table's RLS actually isolates users (not just "has a
 * policy" — a cross-user read/write attempt is exercised as the `authenticated`
 * role, matching how PostgREST actually connects). Mirrors the bootstrap in
 * migration.test.ts; skips 0005/0006 (workspaces/work — unrelated to campaigns,
 * that's a separate in-progress module with its own test file).
 *
 * Run: pnpm --filter @cs/db exec tsx test/campaigns-rls.test.ts
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
const migration4 = readFileSync(path.join(migDir, "0004_caption_broll_unique.sql"), "utf8");
const migration7 = readFileSync(path.join(migDir, "0007_campaigns.sql"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

const db = new PGlite();

await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'
  );
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

await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

try {
  await db.exec(migration);
  await db.exec(migration2);
  await db.exec(migration3);
  await db.exec(migration4);
  await db.exec(migration7);
  check("migrations 0001-0004 + 0007 apply cleanly against real Postgres", true);
} catch (e) {
  check(`migrations apply cleanly — ERROR: ${(e as Error).message}`, false);
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(1);
}

console.log("\n== RLS enabled on campaigns ==");
check("campaigns has RLS enabled",
  (await scalar<boolean>(`select relrowsecurity as v from pg_class where relname='campaigns'`)) === true);

console.log("\n== signup + seed two users ==");
await db.exec(`
  insert into auth.users (id, email) values ('${USER_A}', 'a@x.co'), ('${USER_B}', 'b@x.co');
`);

console.log("\n== owner can insert + read their own campaign (as authenticated) ==");
const days = JSON.stringify(
  Array.from({ length: 7 }, (_, i) => ({
    day: i + 1, goal_th: "test", template: "sales_post", topic_line: `day ${i + 1}`, hook: `hook ${i + 1}`,
  }))
);
await actAs(USER_A);
const insertOwn = await asRole(
  "authenticated",
  `insert into campaigns (user_id, topic, days) values ('${USER_A}', 'ครีมกันแดด', '${days}'::jsonb) returning id as v`
);
check("owner insert succeeds under RLS", insertOwn.ok === true);
const campaignId = insertOwn.ok ? insertOwn.v : null;

const ownRead = await asRole<number>("authenticated", `select count(*)::int as v from campaigns where user_id='${USER_A}'`);
check("owner can read their own campaign", ownRead.ok === true && ownRead.v === 1);

console.log("\n== cross-user isolation: USER_B cannot see or touch USER_A's campaign ==");
await actAs(USER_B);
const crossRead = await asRole<number>("authenticated", `select count(*)::int as v from campaigns where id='${campaignId}'`);
check("other user's SELECT returns zero rows (not an error — RLS filters silently, this is expected)",
  crossRead.ok === true && crossRead.v === 0);

const crossDelete = await asRole<number>("authenticated", `delete from campaigns where id='${campaignId}' returning 1 as v`);
check("other user's DELETE affects zero rows", crossDelete.ok === true && crossDelete.v === undefined);
const stillThere = await scalar<number>(`select count(*)::int as v from campaigns where id='${campaignId}'`);
check("campaign still exists after the cross-user delete attempt", stillThere === 1);

console.log("\n== days payload round-trips intact (7 entries, distinct hooks) ==");
await actAs(USER_A);
const daysBack = await asRole<string>("authenticated", `select days::text as v from campaigns where id='${campaignId}'`);
const parsed = daysBack.ok ? (JSON.parse(daysBack.v) as { hook: string }[]) : [];
check("7 days stored", parsed.length === 7);
check("7 distinct hooks (no accidental collapsing)", new Set(parsed.map((d) => d.hook)).size === 7);

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
