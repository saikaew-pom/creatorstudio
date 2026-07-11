/**
 * Runs migrations 0001-0004 + 0008 against real Postgres (PGlite) and proves:
 *  - the MCP-safe credit RPCs work correctly for a service-role caller AND are
 *    genuinely rejected (permission denied) for an authenticated caller — the whole
 *    point is that a session token can never debit/refund an arbitrary user's ledger
 *    by passing a different p_user_id.
 *  - the Vault-backed API key RPCs round-trip a secret, cross-user isolation holds,
 *    and the plaintext-returning function is rejected for authenticated (service_role
 *    only).
 *
 * Vault itself isn't available in PGlite (real Supabase provides it) — this stubs a
 * MINIMAL vault schema (secrets table + decrypted_secrets view + create_secret/
 * update_secret) sufficient to exercise our migration's SQL and grant logic. It is NOT
 * real encryption; that part only exists in actual Supabase. What this DOES verify:
 * the RPC contracts, the RLS/grant wiring, and the save→update→read→delete lifecycle.
 *
 * Run: pnpm --filter @cs/db exec tsx test/mcp-credits-and-api-keys.test.ts
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
const migration8 = readFileSync(path.join(migDir, "0008_mcp_credits_and_api_keys.sql"), "utf8");

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

// Minimal Vault stub — see module doc comment above for what this does/doesn't prove.
await db.exec(`
  create schema if not exists vault;
  create table vault.secrets (
    id uuid primary key default gen_random_uuid(),
    secret text not null,
    name text,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create view vault.decrypted_secrets as
    select id, name, description, secret as decrypted_secret, created_at, updated_at from vault.secrets;

  create function vault.create_secret(secret text, unique_name text default null, description text default '')
  returns uuid language plpgsql as $$
  declare v_id uuid;
  begin
    insert into vault.secrets (secret, name, description) values (secret, unique_name, description) returning id into v_id;
    return v_id;
  end $$;

  create function vault.update_secret(id uuid, secret text default null, name text default null, description text default null)
  returns void language plpgsql as $$
  begin
    update vault.secrets set secret = coalesce(update_secret.secret, vault.secrets.secret), updated_at = now()
      where vault.secrets.id = update_secret.id;
  end $$;
`);

async function actAs(uid: string) {
  await db.exec(`set app.uid = '${uid}';`);
}
async function scalar<T = unknown>(sql: string): Promise<T> {
  const r = await db.query<{ v: T }>(sql);
  return r.rows[0]?.v as T;
}
async function asRole<T = unknown>(role: string, sql: string): Promise<{ ok: true; v: T; rows: T[] } | { ok: false; error: string }> {
  try {
    await db.exec(`set role ${role};`);
    const r = await db.query<{ v: T }>(sql);
    return { ok: true, v: r.rows[0]?.v as T, rows: r.rows.map((row) => (row as { v: T }).v) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await db.exec(`reset role;`);
  }
}

await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema vault to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

try {
  await db.exec(migration);
  await db.exec(migration2);
  await db.exec(migration3);
  await db.exec(migration4);
  await db.exec(migration8);
  check("migrations 0001-0004 + 0008 apply cleanly against real Postgres", true);
} catch (e) {
  check(`migrations apply cleanly — ERROR: ${(e as Error).message}`, false);
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(1);
}

await db.exec(`insert into auth.users (id, email) values ('${USER_A}', 'a@x.co'), ('${USER_B}', 'b@x.co');`);
// The 0002 signup trigger auto-grants monthly credits on insert into auth.users —
// clear that first so the controlled ledger math below starts from a known balance
// (same reset step migration.test.ts uses for the same reason).
await db.exec(`delete from credit_transactions where user_id in ('${USER_A}', '${USER_B}');`);

// ============ MCP-safe credit RPCs ============
console.log("\n== debit_credits_for_user / refund_credits_for_user: service_role only ==");

await db.exec(`insert into credit_transactions (user_id, amount, kind, bucket) values ('${USER_A}', 20, 'monthly_grant', 'monthly');`);

const authDebit = await asRole("authenticated", `select debit_credits_for_user('${USER_A}', 5, 'x', null, null) as v`);
check("authenticated role CANNOT call debit_credits_for_user (permission denied)", authDebit.ok === false);

const svcDebit = await asRole<number>("service_role", `select debit_credits_for_user('${USER_A}', 5, 'mcp generate_image', 'image_studio', null) as v`);
check("service_role CAN call debit_credits_for_user", svcDebit.ok === true);
check("debit returns correct remaining balance (20-5=15)", svcDebit.ok && svcDebit.v === 15);

const balanceAfterDebit = await scalar<number>(`select coalesce(sum(amount),0)::int as v from credit_transactions where user_id='${USER_A}'`);
check("ledger actually reflects the debit (15)", balanceAfterDebit === 15);

const authRefund = await asRole("authenticated", `select refund_credits_for_user('${USER_A}', 5, 'x', null, null) as v`);
check("authenticated role CANNOT call refund_credits_for_user (permission denied)", authRefund.ok === false);

const svcRefund = await asRole<number>("service_role", `select refund_credits_for_user('${USER_A}', 5, 'mcp refund', 'image_studio', null) as v`);
check("service_role CAN call refund_credits_for_user", svcRefund.ok === true);
check("refund restores balance to 20", svcRefund.ok && svcRefund.v === 20);

const crossUserDebit = await asRole<number>("service_role", `select debit_credits_for_user('${USER_B}', 5, 'x', null, null) as v`);
check("insufficient balance (USER_B has 0) returns -1, not an error", crossUserDebit.ok === true && crossUserDebit.v === -1);

console.log("\n== try_consume_daily_use_for_user: service_role only, enforces the limit ==");
const authQuota = await asRole("authenticated", `select try_consume_daily_use_for_user('${USER_A}', 'content_studio', 3) as v`);
check("authenticated role CANNOT call try_consume_daily_use_for_user (permission denied)", authQuota.ok === false);
const q1 = await asRole<number>("service_role", `select try_consume_daily_use_for_user('${USER_A}', 'content_studio', 3) as v`);
const q2 = await asRole<number>("service_role", `select try_consume_daily_use_for_user('${USER_A}', 'content_studio', 3) as v`);
const q3 = await asRole<number>("service_role", `select try_consume_daily_use_for_user('${USER_A}', 'content_studio', 3) as v`);
const q4 = await asRole<number>("service_role", `select try_consume_daily_use_for_user('${USER_A}', 'content_studio', 3) as v`);
check("1st use returns 2 remaining", q1.ok && q1.v === 2);
check("2nd use returns 1 remaining", q2.ok && q2.v === 1);
check("3rd use returns 0 remaining", q3.ok && q3.v === 0);
check("4th use over limit returns -1", q4.ok && q4.v === -1);

// ============ API keys (Vault-backed) ============
console.log("\n== save_api_key / get_api_key_status: save + update-in-place ==");
await actAs(USER_A);
const save1 = await asRole("authenticated", `select save_api_key('pexels', 'pexels_key_AAAA1111') as v`);
check("owner can save a new key", save1.ok === true);

const status1 = await asRole<string>("authenticated", `select provider, last4, status from get_api_key_status() where provider='pexels'`);
check("get_api_key_status returns the new key", status1.ok === true);

const row1 = await db.query<{ last4: string; status: string }>(
  `select right(vs.decrypted_secret,4) as last4, k.status from user_api_keys k join vault.decrypted_secrets vs on vs.id=k.secret_id where k.user_id='${USER_A}' and k.provider='pexels'`
);
check("last4 matches the tail of the saved secret (1111)", row1.rows[0]?.last4 === "1111");
check("status starts 'unverified'", row1.rows[0]?.status === "unverified");

const keyCountBefore = await scalar<number>(`select count(*)::int as v from user_api_keys where user_id='${USER_A}' and provider='pexels'`);
const save2 = await asRole("authenticated", `select save_api_key('pexels', 'pexels_key_BBBB2222') as v`);
check("saving again (update path) succeeds", save2.ok === true);
const keyCountAfter = await scalar<number>(`select count(*)::int as v from user_api_keys where user_id='${USER_A}' and provider='pexels'`);
check("still exactly one row for (user, provider) — update, not a duplicate", keyCountBefore === 1 && keyCountAfter === 1);
const row2 = await db.query<{ last4: string }>(
  `select right(vs.decrypted_secret,4) as last4 from user_api_keys k join vault.decrypted_secrets vs on vs.id=k.secret_id where k.user_id='${USER_A}' and k.provider='pexels'`
);
check("the vault secret was actually updated (now 2222, not still 1111)", row2.rows[0]?.last4 === "2222");

console.log("\n== cross-user isolation: USER_B cannot see USER_A's key via get_api_key_status ==");
await actAs(USER_B);
const statusB = await asRole<string>("authenticated", `select provider from get_api_key_status()`);
check("USER_B's get_api_key_status returns zero rows (not USER_A's key)", statusB.ok === true && statusB.rows.length === 0);

console.log("\n== get_decrypted_api_key_for_user: service_role only, returns real plaintext ==");
const authRead = await asRole("authenticated", `select get_decrypted_api_key_for_user('${USER_A}', 'pexels') as v`);
check("authenticated role CANNOT call get_decrypted_api_key_for_user (permission denied)", authRead.ok === false);

const svcRead = await asRole<string>("service_role", `select get_decrypted_api_key_for_user('${USER_A}', 'pexels') as v`);
check("service_role CAN call it and gets the real current value", svcRead.ok === true && svcRead.v === "pexels_key_BBBB2222");

console.log("\n== delete_api_key removes both the row and the vault secret ==");
await actAs(USER_A);
const secretIdBefore = await scalar<string>(`select secret_id::text as v from user_api_keys where user_id='${USER_A}' and provider='pexels'`);
const del = await asRole("authenticated", `select delete_api_key('pexels') as v`);
check("owner can delete their key", del.ok === true);
const rowGone = await scalar<number>(`select count(*)::int as v from user_api_keys where user_id='${USER_A}' and provider='pexels'`);
check("user_api_keys row is gone", rowGone === 0);
const vaultSecretGone = await scalar<number>(`select count(*)::int as v from vault.secrets where id='${secretIdBefore}'`);
check("vault secret is also gone (not orphaned)", vaultSecretGone === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail > 0 ? 1 : 0);
