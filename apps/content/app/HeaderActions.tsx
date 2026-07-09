"use client";
import { useEffect, useState } from "react";
import { NotificationBell } from "./NotificationBell";

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("cs-theme") as "dark" | "light") ?? "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("cs-theme", next);
  }
  return (
    <button className="pill" onClick={toggle} aria-label="สลับธีม" title={theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}>
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

export function HeaderActions() {
  return (
    <div style={{ position: "fixed", top: 14, right: 20, zIndex: 40, display: "flex", gap: 8, alignItems: "center" }}>
      <ThemeToggle />
      <NotificationBell />
    </div>
  );
}
