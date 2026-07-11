"use client";
import { useEffect, useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { useLang, useT } from "./LangProvider";

function ThemeToggle() {
  // Light is the default surface (M14 Notion-style redesign) — dark is opt-in
  // via [data-theme="dark"], the reverse of the pre-M14 dark-first palette.
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const t = useT();
  useEffect(() => {
    const saved = (localStorage.getItem("cs-theme") as "dark" | "light") ?? "light";
    setTheme(saved);
    if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("cs-theme", next);
  }
  return (
    <button className="pill" onClick={toggle} aria-label={t("theme.toggle_dark")} title={theme === "dark" ? t("theme.toggle_light") : t("theme.toggle_dark")}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <button className="pill" onClick={() => setLang(lang === "th" ? "en" : "th")} aria-label={t("lang.toggle")} title={t("lang.toggle")}>
      {lang === "th" ? "TH" : "EN"}
    </button>
  );
}

export function HeaderActions() {
  return (
    <div style={{ position: "fixed", top: 14, right: 20, zIndex: 40, display: "flex", gap: 8, alignItems: "center" }}>
      <LangToggle />
      <ThemeToggle />
      <NotificationBell />
    </div>
  );
}
