"use client";
import { useEffect, useState } from "react";
import { browserClient, isSupabaseConfigured, listNotifications, markNotificationsRead, type NotificationRow } from "@cs/db";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) return;
    const db = browserClient();
    const { data } = await db.auth.getUser();
    if (!data.user) { setReady(false); return; }
    setReady(true);
    try { setItems(await listNotifications(db)); } catch { /* ignore */ }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // light polling for render/export completions
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((i) => !i.read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try { await markNotificationsRead(browserClient()); setItems(items.map((i) => ({ ...i, read: true }))); } catch { /* ignore */ }
    }
  }

  if (!ready) return null;

  return (
    <div style={{ position: "relative" }}>
      <button className="pill" onClick={toggle} aria-label="การแจ้งเตือน">
        🔔 {unread > 0 && <span style={{ color: "var(--accent-2)", fontWeight: 700 }}>{unread}</span>}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 40, width: 320, zIndex: 50,
          background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 10,
          maxHeight: 380, overflowY: "auto", boxShadow: "var(--shadow-popover)",
        }}>
          {items.length === 0 && <p className="dim" style={{ padding: 8 }}>ยังไม่มีการแจ้งเตือน</p>}
          {items.map((n) => (
            <a key={n.id} href={n.link ?? "#"} style={{ display: "block", padding: "8px 6px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13 }}>{n.title_th}</div>
              <div className="dim" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString("th-TH")}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
