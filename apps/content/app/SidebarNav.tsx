"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { group: "สร้าง CONTENT", items: [
    { href: "/viral-studio", t: "Viral Studio", s: "หาเทรนด์มาแรงมาทำคอนเทนต์", icon: "🔥" },
    { href: "/studio", t: "Content Studio", s: "คิดไอเดีย · hook · สคริปต์ · ภาพ · แฮชแท็ก", icon: "✏️" },
    { href: "/image-studio", t: "Visual Studio", s: "สร้างภาพแบรนด์ — เทมเพลตพร้อมใช้", icon: "🖼️" },
    { href: "/inspiration", t: "Inspiration", s: "แรงบันดาลใจจากผลงานจริง · ใช้เลย", icon: "💡" },
  ]},
  { group: "แบรนด์ของคุณ", items: [
    { href: "/brands", t: "Brand Voice", s: "ตั้งโทน/สไตล์แบรนด์ของคุณ", icon: "🎙️" },
    { href: "/styles", t: "Style ของฉัน", s: "Style ที่โคลนไว้ใช้ใน Studio", icon: "🎨" },
  ]},
  { group: "ของฉัน", items: [
    { href: "/history", t: "ผลงานของฉัน", s: "ภาพ · เนื้อหา · เทรนด์", icon: "🗂️" },
    { href: "/collections", t: "โฟลเดอร์", s: "จัดกลุ่มผลงานตามแคมเปญ · ลูกค้า", icon: "📁" },
    { href: "/calendar", t: "ปฏิทินคอนเทนต์", s: "วางแผนโพสต์รายเดือน", icon: "📅" },
    { href: "/credits", t: "เครดิต", s: "เครดิตคงเหลือ · เติมเครดิต", icon: "🪙" },
    { href: "/pricing", t: "แพ็กเกจ", s: "แผน Free · Pro · Business", icon: "💳" },
  ]},
];

export function SidebarNav() {
  const path = usePathname();
  return (
    <>
      <Link href="/dashboard" className={`nav-item${path === "/dashboard" ? " active" : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <span style={{ width: 18, textAlign: "center" }}>▦</span>
        <span className="t">Dashboard</span>
      </Link>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="group-label">{g.group}</div>
          {g.items.map((i) => {
            const active = path === i.href || path?.startsWith(i.href + "/");
            return (
              <Link key={i.href} href={i.href} className={`nav-item${active ? " active" : ""}`}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 18, textAlign: "center", flexShrink: 0, marginTop: 1 }}>{i.icon}</span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span className="t">{i.t}</span>
                  <span className="s">{i.s}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
