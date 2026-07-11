"use client";
import { useEffect, useState } from "react";

export function HeaderActions() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
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
    <div style={{ position: "fixed", top: 14, right: 20, zIndex: 40, display: "flex", gap: 8, alignItems: "center" }}>
      <button className="pill" onClick={toggle} aria-label="สลับธีม">
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
