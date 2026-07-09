"use client";
import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@cs/db";

interface TokenRow { id: string; name: string; last_used_at: string | null; revoked: boolean; created_at: string; }

export default function SettingsPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null); // plaintext token shown once
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  async function load() {
    const res = await fetch("/api/mcp-tokens");
    if (res.ok) setTokens((await res.json()).tokens ?? []);
    setLoading(false);
  }
  useEffect(() => { if (isSupabaseConfigured()) load(); else setLoading(false); }, []);

  async function create() {
    setError(null);
    const res = await fetch("/api/mcp-tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setFresh(data.token);
    setName("");
    await load();
  }
  async function revoke(id: string) {
    await fetch(`/api/mcp-tokens?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <h1>Settings · Agent / MCP</h1>
      <p className="dim">ต่อ Claude / agent ของคุณเข้ากับ Creator Studio เพื่อสั่งสร้างวิดีโอด้วยภาษาพูด</p>

      <div className="card">
        <h3>Endpoint</h3>
        <div className="prompt-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{endpoint}</span>
          <button className="btn sm" onClick={() => navigator.clipboard.writeText(endpoint)}>คัดลอก</button>
        </div>
        <p className="dim" style={{ marginTop: 8 }}>
          ⚠ ก่อนสั่งสร้างวิดีโอ ต้องตั้ง API Keys (Gemini จัดการให้แล้ว · ใส่ Pexels/Pixabay สำหรับ B-roll สต็อก)
        </p>
      </div>

      <div className="card">
        <h3>วิธีต่อ (headless agent — Claude Code / Codex / custom)</h3>
        <ol className="dim" style={{ lineHeight: 1.9 }}>
          <li>สร้าง Access Token ด้านล่าง แล้วคัดลอกเก็บไว้ (แสดงครั้งเดียว)</li>
          <li>ตั้งค่า MCP server ใน agent: endpoint ด้านบน + header <code>Authorization: Bearer &lt;token&gt;</code></li>
          <li>เครื่องมือที่ใช้ได้: create_video · get_job_status · set_caption_style · export_video · get_download_url · get_quota</li>
        </ol>
        <p className="dim">Claude Desktop (OAuth, ไม่ต้องใช้ token) — เร็วๆ นี้</p>
      </div>

      <div className="card">
        <div className="section-head"><h3>Access Tokens</h3></div>
        {!isSupabaseConfigured() && <p className="dim">ต้องตั้งค่า Supabase ก่อน</p>}

        {fresh && (
          <div className="card" style={{ borderColor: "var(--success)" }}>
            <b>✅ Token ใหม่ (คัดลอกตอนนี้ — จะไม่แสดงอีก)</b>
            <div className="prompt-box" style={{ marginTop: 6 }}>{fresh}</div>
            <button className="btn sm" style={{ marginTop: 6 }} onClick={() => navigator.clipboard.writeText(fresh)}>คัดลอก Token</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <input className="input" placeholder="ชื่อ token เช่น 'Claude Code'" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" onClick={create} disabled={!isSupabaseConfigured()}>+ สร้าง Token</button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        {loading ? <p className="dim">กำลังโหลด…</p> : tokens.length === 0 ? (
          <p className="dim">ยังไม่มี token</p>
        ) : tokens.map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: t.revoked ? 0.5 : 1 }}>
            <div>
              <div>{t.name} {t.revoked && <span className="pill">เพิกถอนแล้ว</span>}</div>
              <div className="dim" style={{ fontSize: 12 }}>
                {t.last_used_at ? `ใช้ล่าสุด ${new Date(t.last_used_at).toLocaleString("th-TH")}` : "ยังไม่เคยใช้"}
              </div>
            </div>
            {!t.revoked && <button className="btn sm" onClick={() => revoke(t.id)}>เพิกถอน</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
