"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Studio sidebar nav — mirrors the Hero AI studio layout (Dashboard · Video Editor ·
// Gallery · Guide · Updates · Pricing · Settings). Active route is highlighted.
const NAV = [
  { href: "/dashboard", t: "Dashboard", icon: "▦" },
  { href: "/video-editor", t: "Video Editor", icon: "🎬" },
  { href: "/gallery", t: "Gallery", icon: "▶" },
  { href: "/guide", t: "วิธีใช้งาน", icon: "📖" },
  { href: "/updates", t: "อัปเดต", icon: "📣" },
  { href: "/pricing", t: "Pricing", icon: "▭" },
  { href: "/settings", t: "Settings", icon: "⚙" },
];

export function SidebarNav() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV.map((i) => {
        const active = path === i.href || (i.href !== "/dashboard" && path?.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href} className={`nav-item${active ? " active" : ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, textAlign: "center", opacity: 0.8 }}>{i.icon}</span>
            <span className="t">{i.t}</span>
          </Link>
        );
      })}
    </nav>
  );
}
