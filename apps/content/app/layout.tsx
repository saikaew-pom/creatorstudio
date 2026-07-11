import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { getServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { AccountFooter } from "./account-footer";
import { HeaderActions } from "./HeaderActions";
import { SidebarNav } from "./SidebarNav";
import { LangProvider } from "./LangProvider";

export const metadata: Metadata = {
  title: "Creator Studio — Content Engine",
  description: "AI content workspace for Thai creators & SMEs",
};

async function getAccount(): Promise<{ email: string | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getServerSupabase().auth.getUser();
  return data.user ? { email: data.user.email ?? null } : { email: null };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <html lang="th">
      <body>
        <LangProvider>
          <HeaderActions />
          <div className="shell">
            <aside className="sidebar">
              <Link href="/dashboard" className="nav-item" style={{ marginBottom: 6 }}>
                <span className="t">⚡ Creator Studio</span>
                <span className="s">Content Engine</span>
              </Link>
              <SidebarNav />
              <div style={{ marginTop: "auto" }}>
                <AccountFooter
                  configured={isSupabaseConfigured()}
                  email={account?.email ?? null}
                />
              </div>
            </aside>
            <main className="main">{children}</main>
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
