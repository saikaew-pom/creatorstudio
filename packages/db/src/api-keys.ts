// BYO API keys, Vault-backed (migration 0008_mcp_credits_and_api_keys.sql). The actual
// secret value never round-trips through these session-scoped helpers — save/status/
// delete only ever see a masked last4. getDecryptedApiKeyForUser is service_role-only
// and lives separately (admin client, server-only call sites).
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiKeyProvider = "pexels" | "pixabay" | "gemini" | "elevenlabs";

export interface ApiKeyStatus {
  provider: ApiKeyProvider;
  last4: string;
  status: "unverified" | "valid" | "invalid";
  last_tested_at: string | null;
}

export async function saveApiKey(db: SupabaseClient, provider: ApiKeyProvider, secret: string): Promise<void> {
  const { error } = await db.rpc("save_api_key", { p_provider: provider, p_secret: secret });
  if (error) throw error;
}

export async function getApiKeyStatus(db: SupabaseClient): Promise<ApiKeyStatus[]> {
  const { data, error } = await db.rpc("get_api_key_status");
  if (error) throw error;
  return (data ?? []) as ApiKeyStatus[];
}

export async function deleteApiKey(db: SupabaseClient, provider: ApiKeyProvider): Promise<void> {
  const { error } = await db.rpc("delete_api_key", { p_provider: provider });
  if (error) throw error;
}

/** Service-role only — for the worker/API routes to fetch a user's own key to call a
 * third-party provider on their behalf. `admin` must be the service-role client; the
 * underlying RPC's grants reject any other role. Returns null if no key is saved. */
export async function getDecryptedApiKeyForUser(
  admin: SupabaseClient,
  userId: string,
  provider: ApiKeyProvider
): Promise<string | null> {
  const { data, error } = await admin.rpc("get_decrypted_api_key_for_user", { p_user_id: userId, p_provider: provider });
  if (error) throw error;
  return (data as string) ?? null;
}

/** Service-role only — MCP tools call out via the admin client (no session), so
 * auth.uid()-based debit_credits/refund_credits (0001/0003) can't resolve the ledger
 * owner there. These explicit-user-id variants exist only for that trusted path. */
export async function debitCreditsForUser(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  opts: { note: string; refType?: string; refId?: string }
): Promise<number> {
  const { data, error } = await admin.rpc("debit_credits_for_user", {
    p_user_id: userId, p_amount: amount, p_note: opts.note,
    p_ref_type: opts.refType ?? null, p_ref_id: opts.refId ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function refundCreditsForUser(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  opts: { note: string; refType?: string; refId?: string }
): Promise<number> {
  const { data, error } = await admin.rpc("refund_credits_for_user", {
    p_user_id: userId, p_amount: amount, p_note: opts.note,
    p_ref_type: opts.refType ?? null, p_ref_id: opts.refId ?? null,
  });
  if (error) throw error;
  return data as number;
}
