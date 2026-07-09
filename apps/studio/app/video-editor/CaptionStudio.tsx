"use client";
// Step 03 — caption studio. The "แก้ซับเห็นผลทันที" magic: captions are a live CSS
// overlay over the base video (styleToCss from the shared @cs/captions), so changing
// theme/font/position updates instantly with zero re-render. Export burns the same
// style server-side via the identical style definition (cardToSvg), guaranteeing match.
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_STYLE, THEME_LABELS, styleToCss,
  type CaptionCard, type CaptionStyle, type ThemeKey,
} from "@cs/captions";

const FONTS = ["Kanit", "Prompt", "Sarabun", "Mitr"];
const POSITIONS: { label: string; pct: number }[] = [
  { label: "บน", pct: 12 }, { label: "กลาง", pct: 50 }, { label: "ล่าง", pct: 88 },
];

export function CaptionStudio({
  projectId, videoUrl, initialCards, initialStyle,
}: {
  projectId: string;
  videoUrl: string;
  initialCards: CaptionCard[];
  initialStyle?: CaptionStyle;
}) {
  const [cards, setCards] = useState<CaptionCard[]>(initialCards);
  const [style, setStyle] = useState<CaptionStyle>(initialStyle ?? DEFAULT_STYLE);
  const [t, setT] = useState(0); // playback time (s)
  const [previewW, setPreviewW] = useState(320);
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState<string | null>(null);
  const [exportPct, setExportPct] = useState(0);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPreviewW(el.clientWidth));
    ro.observe(el);
    setPreviewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const active = cards.find((c) => t * 1000 >= c.start_ms && t * 1000 < c.end_ms);
  const scale = previewW / 1080; // preview is scaled down from the 1080-ref style

  function set<K extends keyof CaptionStyle>(k: K, v: CaptionStyle[K]) {
    setStyle((s) => ({ ...s, [k]: v }));
  }

  async function doExport() {
    setExporting(true);
    setError(null);
    setFinalUrl(null);
    setExportStep("กำลังเข้าคิว…");
    try {
      const res = await fetch("/api/export", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, cards, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pollRef.current = setInterval(async () => {
        const s = await fetch(`/api/render?jobId=${data.jobId}`).then((r) => r.json());
        setExportPct(s.progress ?? 0);
        setExportStep(s.step_label ?? "กำลังทำงาน…");
        if (s.status === "done") {
          if (pollRef.current) clearInterval(pollRef.current);
          setExporting(false); setExportStep(null);
          const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (base && s.result_path) setFinalUrl(`${base}/storage/v1/object/public/renders/${s.result_path}`);
        } else if (s.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setExporting(false); setError(s.error || "ส่งออกไม่สำเร็จ");
        }
      }, 2500);
    } catch (e) {
      setExporting(false);
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
      {/* Left: video with live caption overlay */}
      <div>
        <div ref={wrapRef} style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} src={videoUrl} controls style={{ width: "100%", display: "block" }}
            onTimeUpdate={(e) => setT((e.target as HTMLVideoElement).currentTime)} />
          {active && (
            <div style={styleToCss(style, active, scale) as React.CSSProperties}>{active.text}</div>
          )}
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>เล่นวิดีโอเพื่อดูซับสด · แก้สไตล์ด้านขวาเห็นผลทันที</p>
      </div>

      {/* Right: style controls + cards */}
      <div>
        <div className="card">
          <h3>สไตล์ซับ</h3>
          <div className="label">ธีม (11 แบบ)</div>
          <div className="chip-row">
            <button className={`chip ${style.theme === null ? "on" : ""}`} onClick={() => set("theme", null)}>ไม่มีธีม</button>
            {(Object.keys(THEME_LABELS) as ThemeKey[]).map((k) => (
              <button key={k} className={`chip ${style.theme === k ? "on" : ""}`} onClick={() => set("theme", k)}>{THEME_LABELS[k]}</button>
            ))}
          </div>

          <div className="label">ฟอนต์</div>
          <div className="chip-row">
            {FONTS.map((f) => (
              <button key={f} className={`chip ${style.font_family === f ? "on" : ""}`} onClick={() => set("font_family", f)}>{f}</button>
            ))}
          </div>

          <div className="label">ขนาด ({style.font_size_px}px)</div>
          <input type="range" min={48} max={130} value={style.font_size_px} style={{ width: "100%" }}
            onChange={(e) => set("font_size_px", Number(e.target.value))} />

          <div className="label">ตำแหน่งแนวตั้ง</div>
          <div className="chip-row">
            {POSITIONS.map((p) => (
              <button key={p.pct} className={`chip ${style.pos_vertical_pct === p.pct ? "on" : ""}`} onClick={() => set("pos_vertical_pct", p.pct)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-head"><h3>การ์ดซับ ({cards.length})</h3></div>
          {cards.map((c, i) => (
            <div key={c.idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span className="pill" style={{ fontSize: 11 }}>{c.type === "hook" ? "HOOK" : `#${i + 1}`}</span>
              <input className="input" style={{ flex: 1, padding: "6px 10px" }} value={c.text}
                onChange={(e) => setCards(cards.map((x) => (x.idx === c.idx ? { ...x, text: e.target.value } : x)))} />
              <span className="dim" style={{ fontSize: 11 }}>{(c.start_ms / 1000).toFixed(1)}s</span>
            </div>
          ))}
        </div>

        {!finalUrl && (
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
            disabled={exporting} onClick={doExport}>
            {exporting ? <><span className="spin" /> {exportStep} {exportPct}%</> : "ส่งออกวิดีโอ (ฝังซับ)"}
          </button>
        )}
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {finalUrl && (
          <div className="card" style={{ borderColor: "var(--success)" }}>
            <h3>✅ ส่งออกเสร็จแล้ว (ฝังซับแล้ว)</h3>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={finalUrl} controls style={{ width: "100%", maxHeight: 360, borderRadius: 12 }} />
            <a className="btn sm" style={{ marginTop: 8 }} href={finalUrl} download target="_blank" rel="noreferrer">⬇ ดาวน์โหลดวิดีโอ</a>
          </div>
        )}
      </div>
    </div>
  );
}
