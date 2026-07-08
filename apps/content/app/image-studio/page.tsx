"use client";
import { useRef, useState } from "react";

const NICHES = ["ทั่วไป", "ขายของออนไลน์", "ร้านอาหาร", "อสังหาริมทรัพย์", "สุขภาพ-ความงาม", "Personal Brand"];
const ASPECTS: { key: "1:1" | "4:5" | "9:16" | "16:9" | "2:3"; label: string }[] = [
  { key: "1:1", label: "1:1" },
  { key: "4:5", label: "4:5" },
  { key: "9:16", label: "9:16" },
  { key: "16:9", label: "16:9" },
  { key: "2:3", label: "2:3" },
];

function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const data = result.split(",")[1];
      resolve({ mimeType: file.type, data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageStudioPage() {
  const [description, setDescription] = useState("");
  const [niche, setNiche] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]["key"]>("1:1");
  const [thaiText, setThaiText] = useState(false);
  const [refImage, setRefImage] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; promptRendered: string; creditsSpent: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cost = thaiText ? 5 : 1;

  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { mimeType, data } = await fileToBase64(file);
    setRefImage({ mimeType, data, preview: URL.createObjectURL(file) });
  }

  async function generate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description,
          niche: niche || undefined,
          aspect,
          thai_text_mode: thaiText,
          reference_image: refImage ? { mimeType: refImage.mimeType, data: refImage.data } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>🎨 Visual Studio</h1>
      <p className="dim">พิมพ์อธิบายรูปที่อยากได้ แล้วให้ AI สร้างให้</p>

      <div className="card">
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onAttach} />
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: 12, border: "1px dashed var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                flexShrink: 0, overflow: "hidden", background: "var(--bg-inset)",
              }}
            >
              {refImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={refImage.preview} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="dim" style={{ fontSize: 24 }}>+</span>
              )}
            </div>
          </div>
          <textarea
            className="input" rows={3} style={{ flex: 1 }}
            placeholder='พิมพ์อธิบายรูปที่อยากได้... เช่น โปสเตอร์โปรโมชั่นร้านกาแฟ โทนอบอุ่น มีข้อความ "ลด 50%"'
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="chip-row" style={{ marginTop: 12 }}>
          <span className="dim">ประเภทธุรกิจ:</span>
          {NICHES.map((n) => (
            <button key={n} className={`chip ${niche === n ? "on" : ""}`} onClick={() => setNiche(niche === n ? "" : n)}>{n}</button>
          ))}
        </div>

        <div className="chip-row">
          <span className="dim">อัตราส่วน:</span>
          {ASPECTS.map((a) => (
            <button key={a.key} className={`chip ${aspect === a.key ? "on" : ""}`} onClick={() => setAspect(a.key)}>{a.label}</button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={thaiText} onChange={(e) => setThaiText(e.target.checked)} />
          <span>ใส่ข้อความไทยในรูปด้วย — ใช้โมเดลที่เขียนภาษาไทยคมชัด (Pro · 5 เครดิต/รูป) · ไม่ติ๊ก = เจนรูปอย่างเดียว (Standard · 1 เครดิต)</span>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16 }}>
          <span className="pill">ใช้ {cost} เครดิต</span>
          <button className="btn primary" disabled={!description.trim() || loading} onClick={generate}>
            {loading ? <><span className="spin" /> กำลังสร้างรูป…</> : "✨ สร้างรูป"}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </div>

      {result && (
        <div className="card">
          <div className="section-head">
            <h3>ผลลัพธ์</h3>
            <span className="pill">ใช้ {result.creditsSpent} เครดิต</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt={description} style={{ maxWidth: "100%", borderRadius: 12, display: "block" }} />
          <div className="dim" style={{ marginTop: 12 }}>Prompt ที่ใช้จริง (แก้ไข/นำไปใช้ที่อื่นได้):</div>
          <div className="prompt-box">{result.promptRendered}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a className="btn sm" href={result.url} download target="_blank" rel="noreferrer">⬇ ดาวน์โหลด</a>
            <button className="btn sm" onClick={() => navigator.clipboard.writeText(result.promptRendered)}>📋 คัดลอก Prompt</button>
            <button className="btn sm" onClick={generate}>🔄 เจนใหม่</button>
          </div>
        </div>
      )}
    </div>
  );
}
