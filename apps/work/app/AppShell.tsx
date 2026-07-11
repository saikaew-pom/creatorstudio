"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MyWorkspace } from "@cs/db";
import { HeaderActions } from "./HeaderActions";
import { SidebarNav } from "./SidebarNav";
import { AccountFooter } from "./account-footer";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export interface Account {
  email: string | null;
  configured: boolean;
  workspaces: MyWorkspace[];
  activeId: string | null;
  entitled: boolean;
  isAdmin: boolean;
}

// Routes that render full-screen with no app sidebar (their own chrome): auth and
// the invite-accept flow, which may be hit before the visitor has any membership.
function isBare(path: string | null): boolean {
  if (!path) return false;
  return path === "/login" || path.startsWith("/auth") || path.startsWith("/invite");
}

export function AppShell({ account, children }: { account: Account | null; children: React.ReactNode }) {
  const path = usePathname();
  if (isBare(path)) return <>{children}</>;

  const workspaces = account?.workspaces ?? [];
  const activeId = account?.activeId ?? workspaces[0]?.id ?? "";

  return (
    <>
      <HeaderActions />
      <div className="shell">
        <aside className="sidebar">
          <Link href="/dashboard" className="nav-item" style={{ marginBottom: 6 }}>
            <span className="t">🗂️ Creator Studio</span>
            <span className="s">Work + CRM</span>
          </Link>

          {workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />}

          <SidebarNav entitled={account?.entitled ?? false} isAdmin={account?.isAdmin ?? false} />

          <div style={{ marginTop: "auto" }}>
            <AccountFooter configured={account?.configured ?? false} email={account?.email ?? null} />
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
