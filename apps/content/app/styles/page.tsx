"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type StyleRow } from "@cs/db";
import type { StyleProfile } from "@cs/prompts";

export default function StylesPage() {
  const [styles, setStyles] = useState<StyleRow[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [samples, setSamples] = useState<string[]>(["", "", ""]);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StyleProfile | null>(null);

  async function load() {
    if (!isSupabaseConfigured()) { setSignedIn(false); return; }
    const db = browserClient();
    const { data: u } = await db.auth.getUser();
    if (!u.user) { setSignedIn(false); return; }
    setSignedIn(true);
    const { data } = await db.from("styles").select("*").order("created_at", { ascending: false });
    setStyles((data ?? []) as StyleRow[]);
  }
  useEffect(() => { load(); }, []);

  async function clone() {
    const clean = samples.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) { setError("วางตัวอย่างโพสต์อย่างน้อย 1 อัน"); return; }
    setCloning(true);
    setError(null);
    try {
      const res = await fetch("/api/style-clone", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ samples: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.style);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setCloning(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/style-clone?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (signedIn === false) {
    return (
      <div>
        <h1>Style Cloner</h1>
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>{isSupabaseConfigured() ? "ยังไม่ได้เข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</b>
          {isSupabaseConfigured() && <div><Link href="/login?next=/styles" className="btn primary" style={{ marginTop: 8 }}>เข้าสู่ระบบ</Link></div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Style Cloner</h1>
      <p className="dim">โคลนสไตล์การเขียนจาก content ที่ชอบ แล้วใช้สไตล์นั้นสร้าง content ของคุณเอง</p>

      {!creating && (
        <button className="btn primary" onClick={() => { setCreating(true); setPreview(null); }}>+ สร้าง Style ใหม่</button>
      )}

      {creating && (
        <div className="card">
          <h3>วางตัวอย่างโพสต์ที่ชอบ (1–3 อัน)</h3>
          <p className="dim">AI จะวิเคราะห์ &quot;วิธีเขียน&quot; (จังหวะ · คำลงท้าย · emoji · โครงสร้าง) ไม่ใช่ลอกเนื้อหา</p>
          {samples.map((s, i) => (
            <textarea key={i} className="input" rows={3} style={{ marginBottom: 8 }}
              placeholder={`ตัวอย่างที่ ${i + 1}`}
              value={s} onChange={(e) => setSamples(samples.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setCreating(false)}>← ยกเลิก</button>
            <button className="btn primary" disabled={cloning} onClick={clone}>
              {cloning ? <><span className="spin" /> AI กำลังวิเคราะห์…</> : "✨ โคลนสไตล์"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}

      {preview && (
        <div className="card" style={{ borderColor: "var(--success)" }}>
          <h3>✓ โคลนแล้ว: {preview.name}</h3>
          <div className="prompt-box" style={{ whiteSpace: "pre-wrap" }}>{preview.profile_markdown}</div>
          <div className="label">ลองเขียนประโยคตามสไตล์นี้:</div>
          <div className="caption-box">{preview.sample_rewrite}</div>
        </div>
      )}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {styles.map((s) => (
          <div key={s.id} className="card" style={{ margin: 0 }}>
            <div style={{ fontWeight: 700 }}>{s.name}</div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
              {s.profile.dna.pronoun} · {s.profile.dna.emoji_set.slice(0, 5).join("")}
            </div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => remove(s.id)}>ลบ</button>
          </div>
        ))}
        {styles.length === 0 && !creating && <p className="dim">ยังไม่มี Style — สร้างอันแรกเพื่อโคลนสไตล์การเขียน</p>}
      </div>
    </div>
  );
}
