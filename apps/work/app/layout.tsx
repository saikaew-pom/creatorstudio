import "./globals.css";
import type { Metadata } from "next";
import { hasFeature } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { getActiveWorkspace } from "../lib/workspace";
import { AppShell, type Account } from "./AppShell";

export const metadata: Metadata = {
  title: "Creator Studio — Work + CRM",
  description: "Team tasks and brand-deal CRM for Creator Studio workspaces",
};

async function getAccount(): Promise<Account | null> {
  const configured = isSupabaseConfigured();
  if (!configured) return { email: null, configured, workspaces: [], activeId: null, entitled: false, isAdmin: false };

  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return { email: null, configured, workspaces: [], activeId: null, entitled: false, isAdmin: false };

  const active = await getActiveWorkspace();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const entitled = active ? await hasFeature(db, active.workspace.id, "work_crm") : false;

  return {
    email: user.email ?? null,
    configured,
    workspaces: active?.memberships ?? [],
    activeId: active?.workspace.id ?? null,
    entitled,
    isAdmin: (profile?.role as string) === "admin",
  };
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
