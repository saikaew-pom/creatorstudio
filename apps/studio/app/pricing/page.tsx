import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getMinutesUsedThisMonth, MINUTE_LIMITS } from "@cs/db";
import { PricingCards } from "./PricingCards";

async function getPlan(): Promise<{ plan: string; used: number; limit: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await db.from("profiles").select("plan").eq("id", data.user.id).maybeSingle();
  const plan = (profile?.plan as string) ?? "free";
  const used = await getMinutesUsedThisMonth(db, data.user.id).catch(() => 0);
  return { plan, used, limit: MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free };
}

export default async function PricingPage() {
  const p = await getPlan();
  return (
    <div>
      {p && (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>
            🛡️ คุณอยู่แผน <b style={{ textTransform: "uppercase" }}>{p.plan}</b> 🎉 · ใช้ไป {p.used}/{p.limit} นาที
          </span>
          <Link href="/settings" style={{ color: "var(--accent-2)" }}>จัดการบิล →</Link>
        </div>
      )}
      <PricingCards currentPlan={p?.plan ?? "free"} />
    </div>
  );
}
