"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", t: "ภาพรวม", icon: "▦" },
  { href: "/members", t: "สมาชิก", icon: "👥" },
];

// M10 lands boards/workload; List/Calendar/Gantt are view tabs INSIDE a board
// (docs/07 §2 — same tasks table, different client), not separate nav entries.
// M11 lands the CRM entries below (deal pipeline is the primary CRM surface,
// companies/contacts are its supporting lists).
const WORK_NAV = [
  { href: "/boards", t: "บอร์ดงาน", icon: "▦" },
  { href: "/workload", t: "ภาระงาน", icon: "⚖" },
  { href: "/crm/deals", t: "ดีล/สปอนเซอร์", icon: "🤝" },
  { href: "/crm/companies", t: "บริษัท", icon: "🏢" },
  { href: "/crm/contacts", t: "ผู้ติดต่อ", icon: "👤" },
];

export function SidebarNav({ entitled, isAdmin }: { entitled: boolean; isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV.map((i) => {
        const active = path === i.href || path?.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} className={`nav-item${active ? " active" : ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, textAlign: "center", opacity: 0.8 }}>{i.icon}</span>
            <span className="t">{i.t}</span>
          </Link>
        );
      })}

      {entitled && (
        <>
          <div className="group-label">Work + CRM</div>
          {WORK_NAV.map((i) => {
            const active = path === i.href || path?.startsWith(i.href + "/");
            return (
              <Link key={i.href} href={i.href} className={`nav-item${active ? " active" : ""}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <span style={{ width: 18, textAlign: "center", opacity: 0.8 }}>{i.icon}</span>
                <span className="t">{i.t}</span>
              </Link>
            );
          })}
        </>
      )}

      {isAdmin && (
        <>
          <div className="group-label">Admin</div>
          <Link href="/admin/workspaces" className={`nav-item${path?.startsWith("/admin") ? " active" : ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, textAlign: "center", opacity: 0.8 }}>🛠</span>
            <span className="t">จัดการสิทธิ์ Workspace</span>
          </Link>
        </>
      )}
    </nav>
  );
}
