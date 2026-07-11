"use client";
import { useEffect, useState } from "react";
import type { InviteRow, MemberRow } from "@cs/db";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ", admin: "แอดมิน", member: "สมาชิก", guest: "ผู้เยี่ยมชม",
};

export function MembersPanel({
  wsId, wsName, myUserId, canManage,
}: { wsId: string; wsName: string; myUserId: string; canManage: boolean }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "guest">("member");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inviteUrl: string; emailSent: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      fetch(`/api/workspaces/${wsId}/members`),
      canManage ? fetch(`/api/workspaces/${wsId}/invites`) : Promise.resolve(null),
    ]);
    const mJson = await mRes.json();
    setMembers(mJson.members ?? []);
    if (iRes) {
      const iJson = await iRes.json();
      setInvites(iJson.invites ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [wsId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendInvite() {
    if (!email.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ส่งคำเชิญไม่สำเร็จ");
      setResult({ inviteUrl: json.inviteUrl, emailSent: json.emailSent });
      setEmail("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, newRole: "admin" | "member" | "guest") {
    setErr(null);
    const res = await fetch(`/api/workspaces/${wsId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErr(json.error ?? "เปลี่ยนบทบาทไม่สำเร็จ");
    }
    await load();
  }

  async function remove(userId: string) {
    if (!confirm("ลบสมาชิกคนนี้ออกจาก workspace?")) return;
    setErr(null);
    const res = await fetch(`/api/workspaces/${wsId}/members?userId=${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErr(json.error ?? "ลบสมาชิกไม่สำเร็จ");
    }
    await load();
  }

  return (
    <div>
      <h1>สมาชิก — {wsName}</h1>
      <p className="dim" style={{ marginBottom: 20 }}>จัดการสมาชิกและคำเชิญของ workspace นี้</p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      {canManage && (
        <div className="card">
          <h3>เชิญสมาชิกใหม่</h3>
          <div className="grid2">
            <input className="input" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)} disabled={busy}>
              <option value="admin">แอดมิน</option>
              <option value="member">สมาชิก</option>
              <option value="guest">ผู้เยี่ยมชม</option>
            </select>
          </div>
          <button className="btn primary" style={{ marginTop: 10 }} disabled={busy || !email.trim()} onClick={sendInvite}>
            {busy ? <span className="spin" /> : "ส่งคำเชิญ"}
          </button>
          {result && (
            <div className="prompt-box" style={{ marginTop: 10 }}>
              {result.emailSent ? "✅ ส่งอีเมลคำเชิญแล้ว — หรือคัดลอกลิงก์นี้ส่งเองก็ได้" : "สร้างคำเชิญแล้ว — คัดลอกลิงก์นี้ส่งให้ผู้รับเชิญได้เลย"}
              <br />
              <span style={{ userSelect: "all" }}>{result.inviteUrl}</span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>สมาชิกปัจจุบัน</h3>
        {loading ? (
          <p className="dim">กำลังโหลด…</p>
        ) : (
          <table className="row-table">
            <thead><tr><th>ชื่อ</th><th>บทบาท</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.display_name ?? m.user_id.slice(0, 8)} {m.user_id === myUserId && <span className="dim">(คุณ)</span>}</td>
                  <td>
                    {canManage && m.role !== "owner" ? (
                      <select className="input" style={{ padding: "4px 8px", fontSize: 12.5 }} value={m.role}
                        onChange={(e) => changeRole(m.user_id, e.target.value as "admin" | "member" | "guest")}>
                        <option value="admin">แอดมิน</option>
                        <option value="member">สมาชิก</option>
                        <option value="guest">ผู้เยี่ยมชม</option>
                      </select>
                    ) : (
                      <span className="pill">{ROLE_LABEL[m.role] ?? m.role}</span>
                    )}
                  </td>
                  {canManage && (
                    <td>
                      {m.role !== "owner" && (
                        <button className="btn sm danger" onClick={() => remove(m.user_id)}>ลบ</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && invites.length > 0 && (
        <div className="card">
          <h3>คำเชิญที่ยังไม่ตอบรับ</h3>
          <table className="row-table">
            <thead><tr><th>อีเมล</th><th>บทบาท</th></tr></thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}><td>{i.email}</td><td><span className="pill">{ROLE_LABEL[i.role] ?? i.role}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
