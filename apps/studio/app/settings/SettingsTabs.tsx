"use client";
import { useEffect, useState } from "react";
import { browserClient, isSupabaseConfigured } from "@cs/db";

export interface SettingsInitial {
  email: string | null;
  displayName: string;
  plan: string;
  minutesUsed: number;
  minuteLimit: number;
  credits: { total: number; monthly: number; purchased: number };
  renewsAt: string | null;
}

interface TokenRow { id: string; name: string; last_used_at: string | null; revoked: boolean; created_at: string; }

type Tab = "profile" | "keys" | "mcp" | "billing";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "keys", label: "API Keys", icon: "🔑" },
  { key: "mcp", label: "Agent / MCP", icon: "⌘" },
  { key: "billing", label: "Billing", icon: "▭" },
];

export function SettingsTabs({ initial }: { initial: SettingsInitial }) {
  const [tab, setTab] = useState<Tab>("profile");
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="dim" style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Account · Settings</div>
      <h1 style={{ margin: "2px 0 4px" }}>Settings</h1>
      <p className="dim" style={{ marginTop: 0 }}>จัดการบัญชี, API keys และการชำระเงินของคุณ</p>

      <div className="chip-row" style={{ margin: "14px 0 18px" }}>
        {TABS.map((t) => (
          <button key={t.key} className={`chip${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab initial={initial} />}
      {tab === "keys" && <KeysTab />}
      {tab === "mcp" && <McpTab />}
      {tab === "billing" && <BillingTab initial={initial} />}
    </div>
  );
}

// ---------------- Profile ----------------
function ProfileTab({ initial }: { initial: SettingsInitial }) {
  const [name, setName] = useState(initial.displayName);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const db = browserClient();
      const { data } = await db.auth.getUser();
      if (!data.user) throw new Error("กรุณาเข้าสู่ระบบ");
      const { error } = await db.from("profiles").update({ display_name: name }).eq("id", data.user.id);
      if (error) throw error;
      setMsg("บันทึกแล้ว ✓");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function resetPw() {
    if (!initial.email) return;
    const db = browserClient();
    await db.auth.resetPasswordForEmail(initial.email, { redirectTo: `${window.location.origin}/login` });
    setMsg("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
  }

  return (
    <>
      <div className="card">
        <h3>Profile Settings</h3>
        <p className="dim" style={{ marginTop: -4 }}>ข้อมูลส่วนตัวและการตั้งค่าบัญชี</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 16px" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>
            {(initial.displayName || initial.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Profile Picture</div>
            <div className="dim" style={{ fontSize: 12 }}>JPG, PNG or GIF · max 2MB (เร็วๆ นี้)</div>
          </div>
        </div>
        <div className="grid2">
          <div>
            <div className="label">Display Name</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="label">Email Address</div>
            <input className="input" value={initial.email ?? ""} disabled style={{ opacity: 0.6 }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button className="btn sm" onClick={resetPw}>Reset Password</button>
          <button className="btn primary" onClick={save} disabled={busy || !isSupabaseConfigured()}>
            {busy ? "กำลังบันทึก…" : "Save Changes"}
          </button>
        </div>
        {msg && <p className="dim" style={{ marginTop: 10 }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>🎟️ ใช้รหัสคูปอง</h3>
        <p className="dim" style={{ marginTop: -4 }}>มีรหัสคูปองอยู่แล้ว? กรอกที่นี่เพื่ออัปเกรดแผนการใช้งานทันที</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="PROMO2025" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button className="btn" onClick={() => setCouponMsg(coupon ? `โค้ด "${coupon}" จะใช้ได้เมื่อระบบชำระเงินเปิด` : null)}>🛒 ใช้คูปอง</button>
        </div>
        {couponMsg && <p className="dim" style={{ marginTop: 8 }}>{couponMsg}</p>}
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span>
          <b>💬 ต้องการความช่วยเหลือ?</b>
          <span className="dim" style={{ display: "block", fontSize: 13 }}>ส่งข้อความหาทีมงาน — ตอบกลับทาง Email ภายใน 24 ชม.</span>
        </span>
        <a className="btn" href="mailto:support@creatorstudio.app">Contact Us</a>
      </div>
    </>
  );
}

// ---------------- API Keys ----------------
function KeysTab() {
  const [pexels, setPexels] = useState("");
  const [pixabay, setPixabay] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setPexels(localStorage.getItem("cs-pexels-key") ?? "");
    setPixabay(localStorage.getItem("cs-pixabay-key") ?? "");
  }, []);
  function save() {
    localStorage.setItem("cs-pexels-key", pexels);
    localStorage.setItem("cs-pixabay-key", pixabay);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  return (
    <>
      <div className="card">
        <h3>API Keys</h3>
        <p className="dim" style={{ marginTop: -4 }}>Gemini + MiniMax จัดการให้แล้ว — ใส่ Pexels/Pixabay เองเพื่อใช้ B-roll สต็อกฟรี</p>
        <div className="prompt-box" style={{ marginTop: 8 }}>
          ✓ Gemini (รูป + สคริปต์) — จัดการให้แล้ว<br />✓ MiniMax (เสียงไทย) — จัดการให้แล้ว
        </div>
        <div className="label">Pexels API Key</div>
        <input className="input" placeholder="ใส่คีย์ Pexels" value={pexels} onChange={(e) => setPexels(e.target.value)} />
        <div className="label">Pixabay API Key</div>
        <input className="input" placeholder="ใส่คีย์ Pixabay" value={pixabay} onChange={(e) => setPixabay(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn primary" onClick={save}>{saved ? "บันทึกแล้ว ✓" : "บันทึกคีย์"}</button>
        </div>
        <p className="dim" style={{ marginTop: 10, fontSize: 12 }}>
          ⚠ ตอนนี้คีย์เก็บบนเครื่องนี้ (device-local) — การเชื่อมคีย์เข้ากับ worker ฝั่งเซิร์ฟเวอร์อยู่ในแผนถัดไป
        </p>
      </div>
    </>
  );
}

// ---------------- Agent / MCP ----------------
function McpTab() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
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
    setFresh(data.token); setName(""); await load();
  }
  async function revoke(id: string) { await fetch(`/api/mcp-tokens?id=${id}`, { method: "DELETE" }); await load(); }

  return (
    <>
      <div className="card">
        <h3>Agent / MCP Access</h3>
        <p className="dim" style={{ marginTop: -4 }}>ต่อ Claude / agent ของคุณเข้ากับ Creator Studio</p>
        <div className="label">Endpoint</div>
        <div className="prompt-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{endpoint}</span>
          <button className="btn sm" onClick={() => navigator.clipboard.writeText(endpoint)}>คัดลอก</button>
        </div>
        <p className="dim" style={{ marginTop: 8 }}>เครื่องมือ: create_video · get_job_status · set_caption_style · export_video · get_download_url · get_quota</p>
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
              <div className="dim" style={{ fontSize: 12 }}>{t.last_used_at ? `ใช้ล่าสุด ${new Date(t.last_used_at).toLocaleString("th-TH")}` : "ยังไม่เคยใช้"}</div>
            </div>
            {!t.revoked && <button className="btn sm" onClick={() => revoke(t.id)}>เพิกถอน</button>}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------- Billing ----------------
const PACKS = [
  { name: "Starter", credits: 100, price: 199, bonus: null as string | null },
  { name: "Popular", credits: 500, price: 899, bonus: "+8%" },
  { name: "Pro", credits: 1000, price: 1599, bonus: "+15%" },
];

function BillingTab({ initial }: { initial: SettingsInitial }) {
  const renew = initial.renewsAt ? new Date(initial.renewsAt).toLocaleDateString("th-TH") : null;
  return (
    <>
      <div className="card">
        <h3>Billing & Payments</h3>
        <p className="dim" style={{ marginTop: -4 }}>ดูประวัติและจัดการแพ็กเกจของคุณ</p>
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 0", background: "var(--bg-inset)" }}>
          <span>
            <span className="pill" style={{ textTransform: "uppercase", borderColor: "var(--success)", color: "var(--success)" }}>{initial.plan}</span>{" "}
            เหลือ <b>{Math.max(0, initial.minuteLimit - initial.minutesUsed)}/{initial.minuteLimit}</b> นาที
            {renew && <span className="dim" style={{ marginLeft: 8 }}>· รีเซ็ต {renew}</span>}
          </span>
          <a href="/pricing" style={{ color: "var(--accent-2)" }}>อัปเกรด →</a>
        </div>
      </div>

      <div>
        <div className="label">🪙 เครดิต AI</div>
        <div className="card" style={{ display: "flex", gap: 24 }}>
          <div><div className="dim" style={{ fontSize: 12 }}>เครดิตแถมเดือนนี้</div><div style={{ fontSize: 26, fontWeight: 700 }}>{initial.credits.monthly}</div></div>
          <div><div className="dim" style={{ fontSize: 12 }}>เครดิตที่ซื้อ</div><div style={{ fontSize: 26, fontWeight: 700 }}>{initial.credits.purchased}</div></div>
          <div><div className="dim" style={{ fontSize: 12 }}>รวม</div><div style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-2)" }}>{initial.credits.total}</div></div>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: -6 }}>เติมเครดิตเพื่อเติมนาทีเมื่อใช้เกินโควตาแพ็ก (2 เครดิต = 1 นาที) · เครดิตที่ซื้ออยู่ถาวร ไม่หายแม้เปลี่ยนแผน</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {PACKS.map((p) => (
            <div key={p.name} className="card" style={{ margin: 0, borderColor: p.bonus ? "var(--gold)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{p.name}</b>{p.bonus && <span className="pill" style={{ fontSize: 11, color: "var(--gold)", borderColor: "var(--gold)" }}>{p.bonus}</span>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{p.credits} <span className="dim" style={{ fontSize: 13, fontWeight: 400 }}>เครดิต</span></div>
              <div className="dim">฿{p.price}</div>
              <button className="btn" disabled title="ต่อระบบชำระเงินในขั้นถัดไป" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>ซื้อ (เร็วๆ นี้)</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
