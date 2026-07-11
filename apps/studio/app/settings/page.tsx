import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getMinutesUsedThisMonth, getCreditBalance, MINUTE_LIMITS } from "@cs/db";
import { SettingsTabs, type SettingsInitial } from "./SettingsTabs";

async function getInitial(): Promise<SettingsInitial> {
  const fallback: SettingsInitial = {
    email: null, displayName: "", plan: "free", minutesUsed: 0,
    minuteLimit: MINUTE_LIMITS.free, credits: { total: 0, monthly: 0, purchased: 0 }, renewsAt: null,
  };
  if (!isSupabaseConfigured()) return fallback;
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return fallback;
  const { data: profile } = await db.from("profiles").select("display_name, plan, plan_renews_at").eq("id", user.id).maybeSingle();
  const plan = (profile?.plan as string) ?? "free";
  const [minutesUsed, credits] = await Promise.all([
    getMinutesUsedThisMonth(db, user.id).catch(() => 0),
    getCreditBalance(db).catch(() => ({ total: 0, monthly: 0, purchased: 0 })),
  ]);
  return {
    email: user.email ?? null,
    displayName: (profile?.display_name as string) ?? "",
    plan,
    minutesUsed,
    minuteLimit: MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free,
    credits,
    renewsAt: (profile?.plan_renews_at as string) ?? null,
  };
}

export default async function SettingsPage() {
  const initial = await getInitial();
  return <SettingsTabs initial={initial} />;
}
