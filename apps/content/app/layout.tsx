import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { getServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { AccountFooter } from "./account-footer";

export const metadata: Metadata = {
  title: "Creator Studio — Content Engine",
  description: "AI content workspace for Thai creators & SMEs",
};

const NAV = [
  { group: "สร้าง CONTENT", items: [
    { href: "/viral-studio", t: "Viral Studio", s: "หาเทรนด์มาแรงมาทำคอนเทนต์" },
    { href: "/studio", t: "Content Studio", s: "คิดไอเดีย · hook · สคริปต์ · ภาพ · แฮชแท็ก" },
    { href: "/image-studio", t: "Visual Studio", s: "สร้างภาพแบรนด์ — เทมเพลตพร้อมใช้" },
    { href: "/inspiration", t: "Inspiration", s: "แรงบันดาลใจจากผลงานจริง · ใช้เลย" },
  ]},
  { group: "แบรนด์ของคุณ", items: [
    { href: "/brands", t: "Brand Voice", s: "ตั้งโทน/สไตล์แบรนด์ของคุณ" },
    { href: "/styles", t: "Style ของฉัน", s: "Style ที่โคลนไว้ใช้ใน Studio" },
  ]},
  { group: "ของฉัน", items: [
    { href: "/history", t: "ผลงานของฉัน", s: "ภาพ · เนื้อหา · เทรนด์" },
    { href: "/calendar", t: "ปฏิทินคอนเทนต์", s: "วางแผนโพสต์รายเดือน" },
    { href: "/credits", t: "เครดิต", s: "เครดิตคงเหลือ · เติมเครดิต" },
  ]},
];

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
        <div className="shell">
          <aside className="sidebar">
            <Link href="/dashboard" className="nav-item">
              <span className="t">⚡ Creator Studio</span>
              <span className="s">Content Engine</span>
            </Link>
            <Link href="/dashboard" className="nav-item"><span className="t">Dashboard</span></Link>
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="group-label">{g.group}</div>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} className="nav-item">
                    <span className="t">{i.t}</span>
                    <span className="s">{i.s}</span>
                  </Link>
                ))}
              </div>
            ))}
            <div style={{ marginTop: "auto" }}>
              <AccountFooter
                configured={isSupabaseConfigured()}
                email={account?.email ?? null}
              />
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
