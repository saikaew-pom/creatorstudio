"use client";
import { useMemo, useState } from "react";
import { splitScript, countThaiWords } from "@cs/prompts";

type Step = 1 | 2;

const VOICES = [
  { id: "aoede", name: "Aoede", desc: "Female · Breezy" },
  { id: "puck", name: "Puck", desc: "Male · Upbeat" },
  { id: "kore", name: "Kore", desc: "Female · Firm" },
];
const MOODS = [
  "Classical-Ambient-Cinematic · แนะนำ",
  "Hip Hop-Funk-Cinematic",
  "Electronic-Laid Back-Upbeat",
  "Jazz-Ambient-Cinematic-Dramatic",
  "Pop-Acoustic-Groovy-Playful",
  "Soul-Groovy-Hopeful",
  "ไม่ใส่เพลง",
];

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function VideoEditor() {
  const [step, setStep] = useState<Step>(1);
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("aoede");
  const [mood, setMood] = useState(MOODS[0]);
  const [brollTier] = useState("ฟรีล้วน");

  const segments = useMemo(() => splitScript(script), [script]);
  const words = useMemo(() => countThaiWords(script), [script]);
  const clipLen = segments.length ? segments[segments.length - 1].est_end : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>New Project</h2>
        <span className="pill">{step === 1 ? "01 สคริปต์" : "✓ สคริปต์"}</span>
        <span className="pill" style={step === 2 ? { borderColor: "var(--accent)" } : {}}>
          02 องค์ประกอบ
        </span>
        <span className="pill dim">03 แต่งซับ (หลังเรนเดอร์)</span>
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="card">
            <h3>สคริปต์ของคุณ</h3>
            <p className="dim">พิมพ์สคริปต์ที่นี่… ขึ้นบรรทัดใหม่ = แยกเซ็กเมนต์ · Enter = ขึ้นเซกเมนต์ใหม่</p>
            <textarea
              className="input" rows={14}
              value={script} onChange={(e) => setScript(e.target.value)}
              placeholder={"วันนี้จะมาเล่าเรื่อง AI ที่ช่วยธุรกิจไทยได้จริง\nเริ่มจากการสร้างคอนเทนต์อัตโนมัติ"}
            />
            <p className="dim" style={{ textAlign: "right" }}>
              {words} คำ · {segments.length} เซ็กเมนต์ · คลิปยาว ~{fmt(clipLen)} นาที
            </p>
          </div>
          <div>
            <div className="card">
              <h3>ระบบแบ่งเซ็กเมนต์ให้แล้ว</h3>
              <p className="dim">ลากการ์ดเพื่อสลับลำดับ (M5)</p>
              {segments.length === 0 && (
                <p className="dim">เริ่มพิมพ์สคริปต์ทางซ้าย ระบบจะแบ่งเซ็กเมนต์ให้อัตโนมัติ</p>
              )}
              {segments.map((s) => (
                <div key={s.idx} className="caption-box" style={{ marginBottom: 8,
                  borderColor: s.type === "hook" ? "var(--accent)" : undefined }}>
                  <div className="dim">
                    {s.type === "hook" ? "HOOK" : `เนื้อหา ${s.idx}`} · {fmt(s.est_start)}–{fmt(s.est_end)}
                  </div>
                  {s.text}
                </div>
              ))}
            </div>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
              disabled={segments.length === 0} onClick={() => setStep(2)}>
              ถัดไป: เลือกองค์ประกอบ →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div>
            <div className="card">
              <h3>บีโรล</h3>
              <p className="dim">ภาพประกอบที่สลับทุก 3–5 วิ ระหว่างเสียงพูด</p>
              <div className="chip-row">
                <span className="chip on">ฟรีล้วน — สต็อกฟรีทั้งหมด · 0 เครดิต</span>
                <span className="chip" style={{ opacity: 0.5 }}>ผสม AI แนะนำ · ~6–9 เครดิต/คลิป (เร็วๆ นี้)</span>
                <span className="chip" style={{ opacity: 0.5 }}>AI เต็มที่ · ~25–45 เครดิต/คลิป (เร็วๆ นี้)</span>
              </div>
            </div>
            <div className="card">
              <h3>เสียงพากย์</h3>
              <p className="dim">เสียง AI อ่านสคริปต์ของคุณ · Gemini (ค่าเริ่มต้น) หรือ ElevenLabs</p>
              <div className="chip-row">
                {VOICES.map((v) => (
                  <button key={v.id} className={`chip ${voice === v.id ? "on" : ""}`}
                    onClick={() => setVoice(v.id)}>
                    🎙 {v.name} — {v.desc}
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>เพลงประกอบ</h3>
              <p className="dim">เพลงเบา ๆ ใต้เสียงพูด (ลดเสียงอัตโนมัติ)</p>
              <div className="chip-row">
                {MOODS.map((m) => (
                  <button key={m} className={`chip ${mood === m ? "on" : ""}`}
                    onClick={() => setMood(m)}>{m}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="card">
              <h3>สรุปการตั้งค่า</h3>
              <table style={{ width: "100%", fontSize: 14 }}>
                <tbody>
                  <tr><td className="dim">สคริปต์</td><td style={{ textAlign: "right" }}>{segments.length} เซ็กเมนต์ · ~{fmt(clipLen)}</td></tr>
                  <tr><td className="dim">บีโรล</td><td style={{ textAlign: "right" }}>{brollTier}</td></tr>
                  <tr><td className="dim">เสียง</td><td style={{ textAlign: "right" }}>Gemini · {VOICES.find((v) => v.id === voice)?.name}</td></tr>
                  <tr><td className="dim">เพลง</td><td style={{ textAlign: "right" }}>{mood.split(" ·")[0]}</td></tr>
                  <tr><td className="dim">อวตาร</td><td style={{ textAlign: "right" }}>Faceless</td></tr>
                </tbody>
              </table>
            </div>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => alert("Render pipeline มาใน M5 — ดู docs/04-video-pipeline.md")}>
              เรนเดอร์วิดีโอ
            </button>
            <p className="dim" style={{ textAlign: "center" }}>
              คลิปยาว ~{fmt(clipLen)} · ใช้ ~{Math.max(1, Math.ceil(clipLen / 60))} นาที · แก้ทุกอย่างได้ทีหลัง
            </p>
            <button className="btn" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setStep(1)}>← กลับไปแก้สคริปต์</button>
          </div>
        </div>
      )}
    </div>
  );
}
