// MCP access tokens (doc 04 §10). A token is shown to the user once; we store only its
// SHA-256 hash. Verification (from the token-authed /api/mcp endpoint) uses the admin
// client to look the hash up and resolve the owning user.
import type { SupabaseClient } from "@supabase/supabase-js";

// Web Crypto (globalThis.crypto) rather than node:crypto — @cs/db's barrel is imported
// by client components too, and a `node:` scheme import breaks the browser bundle. Web
// Crypto works in both Node 20+ and the browser (the token functions only run
// server-side, but the module must be bundleable either way).

export interface McpTokenRow {
  id: string;
  user_id: string;
  name: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

/** Create a token: returns the plaintext ONCE (never stored). Prefix `csk_` so it's
 * recognizable. Session-scoped client (RLS: user owns their tokens). */
export async function createMcpToken(
  db: SupabaseClient,
  userId: string,
  name: string
): Promise<{ token: string; row: McpTokenRow }> {
  const token = "csk_" + toHex(crypto.getRandomValues(new Uint8Array(24)).buffer);
  const { data, error } = await db
    .from("mcp_tokens")
    .insert({ user_id: userId, name, token_hash: await hashToken(token) })
    .select("id, user_id, name, last_used_at, revoked, created_at")
    .single();
  if (error) throw error;
  return { token, row: data as McpTokenRow };
}

export async function listMcpTokens(db: SupabaseClient): Promise<McpTokenRow[]> {
  const { data, error } = await db
    .from("mcp_tokens")
    .select("id, user_id, name, last_used_at, revoked, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as McpTokenRow[];
}

export async function revokeMcpToken(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("mcp_tokens").update({ revoked: true }).eq("id", id);
  if (error) throw error;
}

/** Resolve a presented bearer token → owning user id (or null). Admin client only.
 * Touches last_used_at. */
export async function verifyMcpToken(admin: SupabaseClient, token: string): Promise<string | null> {
  if (!token?.startsWith("csk_")) return null;
  const { data } = await admin
    .from("mcp_tokens")
    .select("id, user_id, revoked")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!data || data.revoked) return null;
  await admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.user_id as string;
}
