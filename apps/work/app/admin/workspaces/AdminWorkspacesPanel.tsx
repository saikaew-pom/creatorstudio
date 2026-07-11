"use client";
import { useEffect, useState } from "react";
import type { AdminWorkspaceRow } from "@cs/db";

const FEATURE = "work_crm";

export function AdminWorkspacesPanel() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/workspaces");
    const json = await res.json();
    if (res.ok) setWorkspaces(json.workspaces ?? []);
    else setErr(json.error ?? "โหลดไม่สำเร็จ");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(ws: AdminWorkspaceRow, currentlyOn: boolean) {
    setBusyId(ws.id);
    setErr(null);
    try {
      const expiresAt = expiryDraft[ws.id]?.trim() || null;
      // The <input type=date> value is a bare "YYYY-MM-DD"; `new Date(str)` parses
      // that form as UTC midnight (ECMA-262), which reads back as the wrong
      // calendar day for any admin west of UTC and expires up to a day early for
      // everyone else. Append a LOCAL end-of-day time first so "pick Aug 1" means
      // "expires at the end of Aug 1 in the admin's own timezone."
      const expiresAtIso = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null;
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: ws.id, feature: FEATURE,
          action: currentlyOn ? "revoke" : "grant",
          expiresAt: currentlyOn ? undefined : expiresAtIso,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setExpiryDraft((d) => { const next = { ...d }; delete next[ws.id]; return next; });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>จัดการสิทธิ์ Workspace</h1>
      <p className="dim" style={{ marginBottom: 20 }}>เปิด/ปิดฟีเจอร์ Work + CRM ต่อ workspace (beta allow-list)</p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="card">
        {loading ? (
          <p className="dim">กำลังโหลด…</p>
        ) : (
          <table className="row-table">
            <thead>
              <tr><th>Workspace</th><th>เจ้าของ</th><th>สมาชิก</th><th>Work + CRM</th><th>หมดอายุ (ถ้ามี)</th><th></th></tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => {
                const ent = ws.entitlements.find((e) => e.feature === FEATURE);
                const expired = ent?.expires_at ? new Date(ent.expires_at) < new Date() : false;
                const on = Boolean(ent) && !expired;
                return (
                  <tr key={ws.id}>
                    <td>{ws.name}</td>
                    <td>{ws.owner_name ?? ws.owner_id.slice(0, 8)}</td>
                    <td>{ws.member_count}</td>
                    <td>
                      <span className={`pill${on ? " on" : ""}`} style={on ? { borderColor: "var(--success)", color: "var(--success)" } : {}}>
                        {on ? "เปิดใช้งาน" : "ปิดอยู่"}
                      </span>
                      {ent?.expires_at && (
                        <div className="dim" style={{ fontSize: 11 }}>
                          {expired ? "หมดอายุแล้ว" : "หมดอายุ"} {new Date(ent.expires_at).toLocaleDateString("th-TH")}
                        </div>
                      )}
                    </td>
                    <td>
                      {!on && (
                        <input type="date" className="input" style={{ padding: "4px 8px", fontSize: 12.5 }}
                          value={expiryDraft[ws.id] ?? ""}
                          onChange={(e) => setExpiryDraft((d) => ({ ...d, [ws.id]: e.target.value }))} />
                      )}
                    </td>
                    <td>
                      <button className={`btn sm${on ? " danger" : " primary"}`} disabled={busyId === ws.id}
                        onClick={() => toggle(ws, on)}>
                        {busyId === ws.id ? <span className="spin" /> : on ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {workspaces.length === 0 && (
                <tr><td colSpan={6} className="dim">ยังไม่มี workspace</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
