import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { SettingsTabs, type SettingsInitial } from "./SettingsTabs";

async function getInitial(): Promise<SettingsInitial> {
  if (!isSupabaseConfigured()) return { email: null, displayName: "" };
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return { email: null, displayName: "" };
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return { email: user.email ?? null, displayName: (profile?.display_name as string) ?? "" };
}

export default async function SettingsPage() {
  const initial = await getInitial();
  return <SettingsTabs initial={initial} />;
}
