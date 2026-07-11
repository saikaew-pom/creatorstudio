"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", t: "ภาพรวม", icon: "▦" },
  { href: "/members", t: "สมาชิก", icon: "👥" },
];

// M10/M11 land the real routes; until then this is a visible-but-inert proof that
// entitlement flips nav on/off (docs/07 §9 M9 accept: "no nav entry" without work_crm).
const COMING_SOON = [
  { t: "บอร์ดงาน", icon: "▦" },
  { t: "ปฏิทิน", icon: "📅" },
  { t: "แกนต์", icon: "▤" },
  { t: "ภาระงาน", icon: "⚖" },
  { t: "ดีล/สปอนเซอร์", icon: "🤝" },
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
          {COMING_SOON.map((i) => (
            <div key={i.t} className="nav-item" style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.45, cursor: "default" }}>
              <span style={{ width: 18, textAlign: "center" }}>{i.icon}</span>
              <span className="t">{i.t}</span>
              <span className="s" style={{ marginLeft: "auto" }}>เร็วๆ นี้</span>
            </div>
          ))}
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
