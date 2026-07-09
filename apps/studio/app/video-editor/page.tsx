"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitScript, countThaiWords } from "@cs/prompts";
import { browserClient, isSupabaseConfigured } from "@cs/db";
import type { CaptionCard } from "@cs/captions";
import { CaptionStudio } from "./CaptionStudio";

type Step = 1 | 2;

// Gemini prebuilt voice ids are capitalized — must match what the TTS call expects.
const VOICES = [
  { id: "Aoede", name: "Aoede", desc: "Female · Breezy" },
  { id: "Puck", name: "Puck", desc: "Male · Upbeat" },
  { id: "Kore", name: "Kore", desc: "Female · Firm" },
  { id: "Charon", name: "Charon", desc: "Male · Deep" },
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
  const [mode, setMode] = useState<"script" | "upload">("script");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("Aoede");
  const [mood, setMood] = useState(MOODS[0]);
  const [brollTier] = useState("ฟรีล้วน");
  const [rendering, setRendering] = useState(false);
  const [renderStep, setRenderStep] = useState<string | null>(null);
  const [renderPct, setRenderPct] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [captionCards, setCaptionCards] = useState<CaptionCard[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const segments = useMemo(() => splitScript(script), [script]);
  const words = useMemo(() => countThaiWords(script), [script]);
  const clipLen = segments.length ? segments[segments.length - 1].est_end : 0;

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Poll a job to completion, then open the caption studio (shared by script + upload).
  function pollJob(jobId: string, projId: string) {
    setProjectId(projId);
    pollRef.current = setInterval(async () => {
      const s = await fetch(`/api/render?jobId=${jobId}`).then((r) => r.json());
      setRenderPct(s.progress ?? 0);
      setRenderStep(s.step_label ?? "กำลังทำงาน…");
      if (s.status === "done") {
        if (pollRef.current) clearInterval(pollRef.current);
        setRendering(false);
        setRenderStep(null);
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (base && s.result_path) setVideoUrl(`${base}/storage/v1/object/public/renders/${s.result_path}`);
        if (isSupabaseConfigured() && projId) {
          const { data: cap } = await browserClient().from("captions").select("cards").eq("project_id", projId).maybeSingle();
          setCaptionCards(((cap?.cards as CaptionCard[]) ?? []));
        }
      } else if (s.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setRendering(false);
        setRenderError(s.error || "เรนเดอร์ไม่สำเร็จ");
      }
    }, 3000);
  }

  async function startRender() {
    setRendering(true); setRenderError(null); setVideoUrl(null); setRenderPct(0);
    setRenderStep("กำลังเข้าคิว…");
    try {
      const res = await fetch("/api/render", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ script, voice, brollTier: "ai" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pollJob(data.jobId, data.projectId);
    } catch (e) {
      setRendering(false);
      setRenderError((e as Error).message);
    }
  }

  async function startUpload() {
    if (!uploadFile) return;
    setStep(2); // jump straight to processing view
    setRendering(true); setRenderError(null); setVideoUrl(null); setRenderPct(0);
    setRenderStep("กำลังอัปโหลดคลิป…");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("name", uploadFile.name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pollJob(data.jobId, data.projectId);
    } catch (e) {
      setRendering(false);
      setRenderError((e as Error).message);
    }
  }

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
        <>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${mode === "script" ? "on" : ""}`} onClick={() => setMode("script")}>✍️ พิมพ์สคริปต์</button>
          <button className={`chip ${mode === "upload" ? "on" : ""}`} onClick={() => setMode("upload")}>🎬 ใช้คลิปที่ถ่ายเอง</button>
        </div>

        {mode === "upload" && (
          <div className="card">
            <h3>อัปคลิปแนวตั้งของคุณ</h3>
            <p className="dim">ระบบจะถอดเสียงเป็นซับไทยให้อัตโนมัติ · เก็บเสียงต้นฉบับต่อเนื่อง · แนวตั้ง 9:16 · ไฟล์ ≤ 50MB</p>
            <input type="file" accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            {uploadFile && <p className="dim" style={{ marginTop: 8 }}>เลือกแล้ว: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)}MB)</p>}
            <button className="btn primary" style={{ marginTop: 12 }} disabled={!uploadFile || rendering} onClick={startUpload}>
              อัปโหลด + ถอดเสียงเป็นซับ →
            </button>
            {renderError && <p style={{ color: "var(--danger)" }}>{renderError}</p>}
          </div>
        )}

        {mode === "script" && (
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
        </>
      )}

      {/* Upload mode: step 2 is just a processing view (transcribe runs in the worker). */}
      {step === 2 && mode === "upload" && !videoUrl && (
        <div className="card">
          <h3>{rendering ? "กำลังประมวลผลคลิป…" : renderError ? "เกิดข้อผิดพลาด" : "เสร็จแล้ว"}</h3>
          {rendering && <p className="dim"><span className="spin" /> {renderStep} {renderPct}%</p>}
          {renderError && <p style={{ color: "var(--danger)" }}>{renderError}</p>}
        </div>
      )}

      {step === 2 && mode === "script" && (
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
              <p className="dim">เสียง AI อ่านสคริปต์ของคุณ · MiniMax (ค่าเริ่มต้น) — เสียงไทยธรรมชาติ</p>
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
                  <tr><td className="dim">เสียง</td><td style={{ textAlign: "right" }}>MiniMax · {VOICES.find((v) => v.id === voice)?.name}</td></tr>
                  <tr><td className="dim">เพลง</td><td style={{ textAlign: "right" }}>{mood.split(" ·")[0]}</td></tr>
                  <tr><td className="dim">อวตาร</td><td style={{ textAlign: "right" }}>Faceless</td></tr>
                </tbody>
              </table>
            </div>
            {!videoUrl && (
              <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
                disabled={rendering} onClick={startRender}>
                {rendering ? <><span className="spin" /> {renderStep} {renderPct}%</> : "เรนเดอร์วิดีโอ"}
              </button>
            )}
            {renderError && <p style={{ color: "var(--danger)" }}>{renderError}</p>}
            <p className="dim" style={{ textAlign: "center" }}>
              คลิปยาว ~{fmt(clipLen)} · ใช้ ~{Math.max(1, Math.ceil(clipLen / 60))} นาที · ปิดแท็บได้ งานทำต่อเบื้องหลัง
            </p>
            {videoUrl && !captionCards && <p className="dim">กำลังโหลดซับ…</p>}
            <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              onClick={() => setStep(1)}>← กลับไปแก้สคริปต์</button>
          </div>
        </div>
      )}

      {/* Step 03 — caption studio (appears once the render is done + cards loaded) */}
      {videoUrl && captionCards && projectId && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="pill" style={{ borderColor: "var(--accent)" }}>03 แต่งซับ</span>
            <b>✅ เรนเดอร์เสร็จแล้ว · แก้ซับเห็นผลทันที ไม่ต้องเรนเดอร์ใหม่</b>
          </div>
          <CaptionStudio projectId={projectId} videoUrl={videoUrl} initialCards={captionCards} />
        </div>
      )}
    </div>
  );
}
