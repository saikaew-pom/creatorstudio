"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./LangProvider";
import type { StringKey } from "../lib/i18n";

const NAV = [
  { groupKey: "nav.group.create" as StringKey, items: [
    { href: "/viral-studio", tKey: "nav.viral_studio.t" as StringKey, sKey: "nav.viral_studio.s" as StringKey, icon: "🔥" },
    { href: "/studio", tKey: "nav.content_studio.t" as StringKey, sKey: "nav.content_studio.s" as StringKey, icon: "✏️" },
    { href: "/image-studio", tKey: "nav.visual_studio.t" as StringKey, sKey: "nav.visual_studio.s" as StringKey, icon: "🖼️" },
    { href: "/inspiration", tKey: "nav.inspiration.t" as StringKey, sKey: "nav.inspiration.s" as StringKey, icon: "💡" },
  ]},
  { groupKey: "nav.group.brand" as StringKey, items: [
    { href: "/brands", tKey: "nav.brand_voice.t" as StringKey, sKey: "nav.brand_voice.s" as StringKey, icon: "🎙️" },
    { href: "/styles", tKey: "nav.styles.t" as StringKey, sKey: "nav.styles.s" as StringKey, icon: "🎨" },
  ]},
  { groupKey: "nav.group.mine" as StringKey, items: [
    { href: "/history", tKey: "nav.history.t" as StringKey, sKey: "nav.history.s" as StringKey, icon: "🗂️" },
    { href: "/collections", tKey: "nav.collections.t" as StringKey, sKey: "nav.collections.s" as StringKey, icon: "📁" },
    { href: "/calendar", tKey: "nav.calendar.t" as StringKey, sKey: "nav.calendar.s" as StringKey, icon: "📅" },
    { href: "/credits", tKey: "nav.credits.t" as StringKey, sKey: "nav.credits.s" as StringKey, icon: "🪙" },
    { href: "/pricing", tKey: "nav.pricing.t" as StringKey, sKey: "nav.pricing.s" as StringKey, icon: "💳" },
    { href: "/settings", tKey: "nav.settings.t" as StringKey, sKey: "nav.settings.s" as StringKey, icon: "⚙️" },
  ]},
];

export function SidebarNav() {
  const path = usePathname();
  const t = useT();
  return (
    <>
      <Link href="/dashboard" className={`nav-item${path === "/dashboard" ? " active" : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <span style={{ width: 18, textAlign: "center" }}>▦</span>
        <span className="t">{t("nav.dashboard")}</span>
      </Link>
      {NAV.map((g) => (
        <div key={g.groupKey}>
          <div className="group-label">{t(g.groupKey)}</div>
          {g.items.map((i) => {
            const active = path === i.href || path?.startsWith(i.href + "/");
            return (
              <Link key={i.href} href={i.href} className={`nav-item${active ? " active" : ""}`}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 18, textAlign: "center", flexShrink: 0, marginTop: 1 }}>{i.icon}</span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span className="t">{t(i.tKey)}</span>
                  <span className="s">{t(i.sKey)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
