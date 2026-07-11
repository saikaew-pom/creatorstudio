"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderActions } from "./HeaderActions";
import { SidebarNav } from "./SidebarNav";

export interface Account {
  email: string | null;
  plan: string;
  minutesUsed: number;
  minuteLimit: number;
}

// Routes that render full-screen with no app sidebar (their own chrome): the timeline
// editor and the auth screens.
function isBare(path: string | null): boolean {
  if (!path) return false;
  return path === "/login" || path.startsWith("/video-editor") || path.startsWith("/auth");
}

export function AppShell({ account, children }: { account: Account | null; children: React.ReactNode }) {
  const path = usePathname();
  if (isBare(path)) return <>{children}</>;

  const plan = account?.plan ?? "free";
  const used = account?.minutesUsed ?? 0;
  const limit = account?.minuteLimit ?? 5;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return (
    <>
      <HeaderActions />
      <div className="shell">
        <aside className="sidebar">
          <Link href="/dashboard" className="nav-item" style={{ marginBottom: 6 }}>
            <span className="t">🎬 Creator Studio</span>
            <span className="s">Video Studio</span>
          </Link>
          <SidebarNav />

          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <div className="card" style={{ margin: 0, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="pill" style={{ textTransform: "uppercase", fontSize: 11, borderColor: "var(--accent)", color: "var(--accent-2)" }}>
                  {plan} plan
                </span>
                <span className="dim" style={{ fontSize: 12 }}>{used}/{limit} นาที</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--bg-inset)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              </div>
            </div>
            <Link href="/pricing" className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}>
              อัปเกรดแผน
            </Link>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                {account?.email ?? "โหมดทดลอง"}
              </span>
              <a href="mailto:support@creatorstudio.app">Support</a>
            </div>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
