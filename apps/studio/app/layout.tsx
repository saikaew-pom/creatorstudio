import "./globals.css";
import type { Metadata } from "next";
import { getServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { getMinutesUsedThisMonth, MINUTE_LIMITS } from "@cs/db";
import { AppShell, type Account } from "./AppShell";

export const metadata: Metadata = {
  title: "Creator Studio — Video",
  description: "AI faceless-video factory: script → voice → B-roll → captions",
};

async function getAccount(): Promise<Account | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return { email: null, plan: "free", minutesUsed: 0, minuteLimit: MINUTE_LIMITS.free };
  const { data: profile } = await db.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = (profile?.plan as string) ?? "free";
  let minutesUsed = 0;
  try { minutesUsed = await getMinutesUsedThisMonth(db, user.id); } catch { /* ignore */ }
  return { email: user.email ?? null, plan, minutesUsed, minuteLimit: MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <html lang="th">
      <body>
        <AppShell account={account}>{children}</AppShell>
      </body>
    </html>
  );
}
