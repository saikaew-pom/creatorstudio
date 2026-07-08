"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type TemplateRow } from "@cs/db";
import type { ViralKit } from "@cs/prompts";

function copy(t: string) { void navigator.clipboard.writeText(t); }

export default function ViralTemplatePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [tpl, setTpl] = useState<TemplateRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<ViralKit | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const db = browserClient();
    db.from("templates").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      setTpl((data as TemplateRow) ?? null);
      setLoading(false);
    });
  }, [slug]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/viral-kit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, formValues: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKit(data.kit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="dim">กำลังโหลด…</p>;
  if (!tpl) return (
    <div>
      <Link href="/viral-studio" className="btn sm">← กลับ</Link>
      <div className="card"><p className="dim">ไม่พบเทมเพลตนี้</p></div>
    </div>
  );

  return (
    <div>
      <Link href="/viral-studio" className="btn sm">← Viral Studio</Link>
      <h1 style={{ marginTop: 12 }}>{tpl.name_th}</h1>
      <p className="dim">{tpl.category} · ใช้ {tpl.usage_count} ครั้ง</p>

      <div className="card">
        <h3>กรอกข้อมูล</h3>
        {tpl.form.map((f) => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div className="label">{f.label_th}{"required" in f && f.required ? " *" : ""}</div>
            {f.type === "select" ? (
              <select className="input" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                <option value="">เลือก…</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label_th}</option>)}
              </select>
            ) : f.type === "text" ? (
              <input className="input" placeholder={f.placeholder_th}
                value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            ) : (
              <div className="dim">อัปโหลดรูป — เร็วๆ นี้</div>
            )}
          </div>
        ))}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
          disabled={generating} onClick={generate}>
          {generating ? <><span className="spin" /> กำลังสร้าง Output…</> : "✨ สร้าง Output"}
        </button>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </div>

      {kit?.sets.map((s, i) => (
        <div key={i} className="card">
          <div className="section-head">
            <h3>ชุดที่ {i + 1}{s.object_th ? ` · ${s.object_th}` : ""}</h3>
          </div>

          <div className="label">🎨 Image Prompt (EN)</div>
          <div className="prompt-box">{s.character_image_prompt_en}</div>
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => copy(s.character_image_prompt_en)}>คัดลอก</button>

          {s.video_prompt_en.length > 0 && (
            <>
              <div className="label">🎬 Video / รายละเอียด</div>
              {s.video_prompt_en.map((v) => (
                <div key={v.scene} className="prompt-box" style={{ marginBottom: 6 }}>ซีน {v.scene}: {v.prompt}</div>
              ))}
            </>
          )}

          {s.dialogue_th.length > 0 && (
            <>
              <div className="label">💬 บทพูด / แคปชัน</div>
              {s.dialogue_th.map((d) => (
                <div key={d.scene} className="caption-box" style={{ marginBottom: 6 }}>{d.line}</div>
              ))}
            </>
          )}

          {s.voiceover_direction_th && (
            <>
              <div className="label">🎙 บรีฟเสียงพากย์</div>
              <div className="caption-box">{s.voiceover_direction_th}</div>
            </>
          )}

          <div className="label"># Hashtags</div>
          <div className="chip-row">{s.hashtags.map((h) => <span key={h} className="chip">{h}</span>)}</div>

          <button className="btn sm" style={{ marginTop: 10 }}
            onClick={() => copy(s.caption_th + "\n\n" + s.hashtags.join(" "))}>📋 คัดลอกแคปชัน + แฮชแท็ก</button>
        </div>
      ))}
      {kit && (
        <p className="dim">💡 Copy prompt ไปวางใน ChatGPT, Gemini, Midjourney หรือ AI ตัวไหนก็ได้ · หรือใช้ Visual Studio เจนภาพต่อได้เลย</p>
      )}
    </div>
  );
}
