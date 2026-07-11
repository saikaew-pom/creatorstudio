"use client";
import { useState } from "react";
import type { MyWorkspace } from "@cs/db";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ", admin: "แอดมิน", member: "สมาชิก", guest: "ผู้เยี่ยมชม",
};

export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: MyWorkspace[]; activeId: string }) {
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function switchTo(id: string) {
    if (id === activeId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (res.ok) {
        // A full navigation, not router.refresh()+push — the root layout reads
        // the active-workspace cookie once per request, and router.refresh()
        // wasn't reliably invalidating it (the dropdown kept its stale
        // selection while the page content underneath it was already correct).
        // Matches how the rest of this app already handles auth/session
        // transitions (login, logout) — a hard navigation, not the client router.
        window.location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้าง workspace ไม่สำเร็จ");
      setName("");
      setCreating(false);
      await switchTo(json.workspace.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          className="input"
          style={{ fontSize: 13, padding: "7px 10px", flex: 1 }}
          value={activeId}
          disabled={busy}
          onChange={(e) => switchTo(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {ROLE_LABEL[w.role] ?? w.role}
            </option>
          ))}
        </select>
        <button className="btn sm" title="สร้าง workspace ใหม่" disabled={busy}
          onClick={() => setCreating((c) => !c)}>
          +
        </button>
      </div>
      {creating && (
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <input
            className="input"
            style={{ fontSize: 13, padding: "7px 10px" }}
            placeholder="ชื่อ workspace"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
          />
          <button className="btn sm primary" disabled={busy || !name.trim()} onClick={createWorkspace}>
            {busy ? <span className="spin" /> : "สร้าง"}
          </button>
        </div>
      )}
      {err && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{err}</p>}
    </div>
  );
}
