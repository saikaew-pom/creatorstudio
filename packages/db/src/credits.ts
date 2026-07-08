// Credit ledger + daily-quota helpers. Pass a session-scoped client (serverClient)
// so the RPCs' auth.uid() resolves to the signed-in user. All balance math lives in
// the DB (append-only ledger + SECURITY DEFINER RPCs), verified in test/migration.test.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditTxnRow, CreditBucket } from "./types";

export interface CreditBalance {
  total: number;
  monthly: number;
  purchased: number;
}

export async function getCreditBalance(db: SupabaseClient): Promise<CreditBalance> {
  const { data, error } = await db
    .from("credit_transactions")
    .select("amount, bucket");
  if (error) throw error;
  let monthly = 0;
  let purchased = 0;
  for (const row of (data ?? []) as { amount: number; bucket: CreditBucket }[]) {
    if (row.bucket === "monthly") monthly += row.amount;
    else purchased += row.amount;
  }
  return { total: monthly + purchased, monthly, purchased };
}

/** Atomic debit (monthly bucket first, then purchased). Returns the new total
 * balance, or -1 if the user had insufficient credits (no rows written). */
export async function debitCredits(
  db: SupabaseClient,
  amount: number,
  opts: { note: string; refType?: string; refId?: string }
): Promise<number> {
  const { data, error } = await db.rpc("debit_credits", {
    p_amount: amount,
    p_note: opts.note,
    p_ref_type: opts.refType ?? null,
    p_ref_id: opts.refId ?? null,
  });
  if (error) throw error;
  return data as number;
}

/** Refund via the refund_credits RPC (doc 03 migration 0003) — NOT a raw insert.
 * credit_transactions has an RLS SELECT policy for owners but deliberately no
 * INSERT policy (writes are meant to go through SECURITY DEFINER RPCs only); a
 * raw `.insert()` here was tried first and found live to fail silently under
 * RLS, which meant a failed generation debited credits and never gave them
 * back. See packages/db/test/migration.test.ts for the regression coverage. */
export async function refundCredits(
  db: SupabaseClient,
  amount: number,
  opts: { note: string; refType?: string; refId?: string }
): Promise<number> {
  const { data, error } = await db.rpc("refund_credits", {
    p_amount: amount,
    p_note: opts.note,
    p_ref_type: opts.refType ?? null,
    p_ref_id: opts.refId ?? null,
  });
  if (error) throw error;
  return data as number;
}

/** Consume one unit of the daily free quota for a tool. Returns remaining count,
 * or -1 if the daily limit is already reached. */
export async function tryConsumeDailyUse(
  db: SupabaseClient,
  tool: string,
  limit: number
): Promise<number> {
  const { data, error } = await db.rpc("try_consume_daily_use", {
    p_tool: tool,
    p_limit: limit,
  });
  if (error) throw error;
  return data as number;
}

export async function getCreditHistory(
  db: SupabaseClient,
  limit = 50
): Promise<CreditTxnRow[]> {
  const { data, error } = await db
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CreditTxnRow[];
}
