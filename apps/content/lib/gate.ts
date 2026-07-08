// Shared gate for AI generation routes: resolves the user, enforces the daily free
// quota, and hands back a session-scoped db client for persistence. Degrades
// gracefully when Supabase isn't configured (dev/demo mode: no auth, no quota, no
// persistence) so the app runs exactly as it did pre-M1.
import { getServerSupabase, isSupabaseConfigured } from "./supabase-server";
import { DAILY_LIMITS, tryConsumeDailyUse } from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GateResult =
  | { kind: "unconfigured" } // no Supabase — proceed without gating/persistence
  | { kind: "unauthorized" }
  | { kind: "quota_exceeded"; limit: number }
  | { kind: "ok"; userId: string; plan: string; remaining: number; db: SupabaseClient };

export async function gateGeneration(tool: string): Promise<GateResult> {
  if (!isSupabaseConfigured()) return { kind: "unconfigured" };

  const db = getServerSupabase();
  const { data: userData } = await db.auth.getUser();
  const user = userData.user;
  if (!user) return { kind: "unauthorized" };

  const { data: profile } = await db
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan = (profile?.plan as string) ?? "free";
  const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;

  const remaining = await tryConsumeDailyUse(db, tool, limit);
  if (remaining < 0) return { kind: "quota_exceeded", limit };

  return { kind: "ok", userId: user.id, plan, remaining, db };
}

/** Maps a non-ok gate result to an HTTP response shape. Returns null when ok/unconfigured. */
export function gateError(
  gate: GateResult
): { body: { error: string }; status: number } | null {
  switch (gate.kind) {
    case "unauthorized":
      return { body: { error: "กรุณาเข้าสู่ระบบก่อน" }, status: 401 };
    case "quota_exceeded":
      return {
        body: { error: `ใช้ครบโควตาวันนี้แล้ว (${gate.limit}/วัน) — เพิ่ม API Key เพื่อใช้ไม่จำกัด หรือรอพรุ่งนี้` },
        status: 429,
      };
    default:
      return null;
  }
}
