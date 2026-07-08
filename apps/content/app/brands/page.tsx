"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type BrandRow } from "@cs/db";
import type { Brand, BrandFieldKey } from "@cs/prompts";

const STARTER_CHIPS = [
  "ฉันขาย __ ให้ลูกค้า __",
  "ลูกค้าหลักของฉันคือ __ อายุ __",
  "อยากให้แบรนด์พูดแบบ __",
  "คำที่อยากใช้: __ คำที่ไม่อยากใช้: __",
];

const FIELD_LABELS: Record<BrandFieldKey, string> = {
  name: "ชื่อแบรนด์",
  business: "ธุรกิจ",
  audience: "กลุ่มลูกค้า",
  tone: "โทนการพูด",
  pronoun: "สรรพนาม",
  words_use: "คำที่ใช้",
  words_avoid: "คำที่เลี่ยง",
  emoji_policy: "นโยบาย emoji",
  hashtags: "แฮชแท็ก",
  sample_lines: "ประโยคตัวอย่าง",
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [step, setStep] = useState<0 | 1>(0); // 0 = list, 1 = wizard
  const [story, setStory] = useState("");
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) { setSignedIn(false); return; }
    const db = browserClient();
    const { data: u } = await db.auth.getUser();
    if (!u.user) { setSignedIn(false); return; }
    setSignedIn(true);
    const { data } = await db.from("brands").select("*").order("created_at", { ascending: false });
    setBrands((data ?? []) as BrandRow[]);
  }
  useEffect(() => { load(); }, []);

  async function aiFill() {
    setFilling(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-fill", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ free_text_story: story }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.brand);
    } catch (e) { setError((e as Error).message); }
    finally { setFilling(false); }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brands", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: draft.name, data: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(null); setStory(""); setStep(0);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/brands?id=${id}`, { method: "DELETE" });
    await load();
  }

  function setField<K extends keyof Brand>(k: K, v: Brand[K]) {
    if (draft) setDraft({ ...draft, [k]: v });
  }

  if (signedIn === false) {
    return (
      <div>
        <h1>🎨 Brand Voice</h1>
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>{isSupabaseConfigured() ? "ยังไม่ได้เข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</b>
          {isSupabaseConfigured() && <div><Link href="/login?next=/brands" className="btn primary" style={{ marginTop: 8 }}>เข้าสู่ระบบ</Link></div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>🎨 Brand Voice</h1>
      <p className="dim">เล่าให้ AI ฟัง · AI กรอก fields ให้ครบ · บันทึกใน 3 นาที</p>

      {step === 0 && (
        <>
          <button className="btn primary" onClick={() => setStep(1)}>+ สร้าง Brand ใหม่</button>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {brands.map((b) => (
              <div key={b.id} className="card" style={{ margin: 0 }}>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                <div className="dim" style={{ fontSize: 13 }}>{b.data.tone}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>สรรพนาม: {b.data.pronoun}</div>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => remove(b.id)}>ลบ</button>
              </div>
            ))}
            {brands.length === 0 && <p className="dim">ยังไม่มีแบรนด์ — เล่าเรื่องธุรกิจให้ AI ฟังเพื่อสร้างอันแรก</p>}
          </div>
        </>
      )}

      {step === 1 && !draft && (
        <div className="card">
          <h3>① เล่าให้ AI ฟัง · เดี๋ยว AI กรอกให้</h3>
          <p className="dim">เล่าเกี่ยวกับธุรกิจคุณภาษาไทยปกติ — AI จะอ่านแล้วช่วยกรอกข้อมูลแบรนด์ให้ (โทน · กลุ่มลูกค้า · คำที่ใช้ · แฮชแท็ก)</p>
          <textarea className="input" rows={6}
            placeholder="ตัวอย่าง: ฉันเปิดร้านกาแฟชื่อ Cafe Smile ที่อารีย์ ลูกค้าหลักเป็นคนทำงานช่วงวันธรรมดา ชอบมานั่งทำงาน อยากให้ tone อบอุ่น เป็นมิตร ไม่ทางการ ใช้ emoji ปานกลาง"
            value={story} onChange={(e) => setStory(e.target.value)} />
          <div className="chip-row">
            {STARTER_CHIPS.map((c) => (
              <button key={c} className="chip" onClick={() => setStory((s) => (s ? s + "\n" : "") + c)}>+ {c}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(0)}>← กลับ</button>
            <button className="btn primary" disabled={!story.trim() || filling} onClick={aiFill}>
              {filling ? <><span className="spin" /> AI กำลังอ่าน…</> : "✨ ให้ AI กรอกให้ →"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}

      {step === 1 && draft && (
        <div className="card">
          <h3>② ตรวจ + บันทึก</h3>
          <p className="dim">AI กรอกให้แล้ว — ตรวจดูและแก้ได้ · ช่องที่มีป้าย <span className="pill">AI เดาให้</span> คือ AI อนุมานเอง ควรเช็ก</p>

          {(["name", "business", "audience", "tone", "pronoun"] as const).map((k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {FIELD_LABELS[k]}
                {draft.confidence[k] === "guessed" && <span className="pill" style={{ fontSize: 10, borderColor: "var(--warn)" }}>AI เดาให้</span>}
              </div>
              <input className="input" value={draft[k]} onChange={(e) => setField(k, e.target.value)} />
            </div>
          ))}

          <div style={{ marginBottom: 10 }}>
            <div className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {FIELD_LABELS.emoji_policy}
              {draft.confidence.emoji_policy === "guessed" && <span className="pill" style={{ fontSize: 10, borderColor: "var(--warn)" }}>AI เดาให้</span>}
            </div>
            <select className="input" value={draft.emoji_policy} onChange={(e) => setField("emoji_policy", e.target.value as Brand["emoji_policy"])}>
              {["none", "light", "medium", "heavy"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {(["words_use", "words_avoid", "hashtags"] as const).map((k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {FIELD_LABELS[k]} <span className="dim">(คั่นด้วย ,)</span>
                {draft.confidence[k] === "guessed" && <span className="pill" style={{ fontSize: 10, borderColor: "var(--warn)" }}>AI เดาให้</span>}
              </div>
              <input className="input" value={draft[k].join(", ")}
                onChange={(e) => setField(k, e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
            </div>
          ))}

          <div className="label">ประโยคตัวอย่าง (เสียงแบรนด์)</div>
          {draft.sample_lines.map((line, i) => (
            <div key={i} className="caption-box" style={{ marginBottom: 6 }}>{line}</div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <button className="btn" onClick={() => setDraft(null)}>← แก้เรื่องเล่า</button>
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? <><span className="spin" /> บันทึก…</> : "💾 บันทึกแบรนด์"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
