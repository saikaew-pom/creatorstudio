"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ContentKit, Platform, TemplateChip } from "@cs/prompts";

const TEMPLATES: { key: TemplateChip; label: string }[] = [
  { key: "portfolio", label: "💼 Portfolio งานที่ทำ" },
  { key: "day_in_life", label: "📅 Day in the life" },
  { key: "new_product", label: "✨ เปิดตัวสินค้าใหม่" },
  { key: "honest_review", label: "⭐ รีวิวแบบจริงใจ" },
  { key: "before_after", label: "🔄 Before-After" },
  { key: "five_tips", label: "💡 เคล็ดลับ 5 ข้อ" },
  { key: "promotion", label: "🔥 Promotion ลดราคา" },
];
const NICHES = ["ทั่วไป","ขายของออนไลน์","ร้านอาหาร","อสังหาริมทรัพย์","การเงิน-ลงทุน","สุขภาพ-ความงาม","การศึกษา-คอร์ส","ฟรีแลนซ์-บริการ","เกษตร-OTOP","ช่าง-รับเหมา","ท่องเที่ยว-โรงแรม","Personal Brand"];
const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "tts", label: "TTS (เสียง)" },
];
const HOOK_TYPES: { key: string; label: string }[] = [
  { key: "auto", label: "✨ อัตโนมัติ" },
  { key: "question", label: "❓ คำถาม" },
  { key: "fomo", label: "🔥 FOMO" },
  { key: "story", label: "📖 เรื่องเล่า" },
  { key: "stat", label: "📊 สถิติ-ตัวเลข" },
];

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

function StudioInner() {
  const params = useSearchParams();
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [niche, setNiche] = useState("");
  const [template, setTemplate] = useState<TemplateChip | undefined>();
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook"]);
  const [kit, setKit] = useState<ContentKit | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeHookType, setActiveHookType] = useState("auto");
  const [showAllHooks, setShowAllHooks] = useState(false);
  const [scriptTab, setScriptTab] = useState(0);
  const [visualTab, setVisualTab] = useState<"cover" | "ill" | "video">("cover");
  const [refineText, setRefineText] = useState("");
  const [generationId, setGenerationId] = useState<string | undefined>();

  async function generate() {
    setLoading("กำลังสร้างชุดคอนเทนต์… (hook · สคริปต์ · visual · แฮชแท็ก)");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, niche: niche || undefined, template, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKit(data.kit);
      setGenerationId(data.generationId);
      setScriptTab(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function refineAll(section?: "hook" | "script" | "visual" | "hashtags", instruction?: string) {
    const inst = instruction ?? refineText;
    if (!kit || !inst.trim()) return;
    setLoading(section ? `กำลังปรับส่วน ${section}…` : "กำลังปรับทั้งชุด…");
    setError(null);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kit, instruction: inst, section, generationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKit(data.kit);
      if (!section) setRefineText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function sectionRefine(section: "hook" | "script" | "visual" | "hashtags") {
    const inst = window.prompt("จะให้ปรับยังไงดี? เช่น 'สั้นลง', 'เป็นกันเองขึ้น'");
    if (inst) void refineAll(section, inst);
  }

  const activeHook =
    kit?.hooks.find((h) => h.type === activeHookType) ??
    kit?.hooks.find((h) => h.is_recommended) ??
    kit?.hooks[0];

  return (
    <div>
      <h1>Content Studio</h1>
      <div className="card">
        <div className="label">หัวข้อ / ไอเดียที่อยากเล่า</div>
        <textarea
          className="input" rows={2}
          placeholder='เช่น "AI ช่วย SME ไทยลดต้นทุน 70%" หรือ "5 เคล็ดลับโพสต์ FB ที่ไม่มีคน scroll ผ่าน"'
          value={topic} onChange={(e) => setTopic(e.target.value)}
        />
        <div className="label">หรือเริ่มจากเทมเพลตที่ตรงกับธุรกิจคุณ:</div>
        <div className="chip-row">
          {TEMPLATES.map((t) => (
            <button key={t.key} className={`chip ${template === t.key ? "on" : ""}`}
              onClick={() => setTemplate(template === t.key ? undefined : t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="label">ประเภทธุรกิจ / Niche <span className="dim">(ไม่บังคับ)</span></div>
        <input className="input" placeholder="ระบุประเภทธุรกิจของคุณ เช่น เกษตร, ที่ปรึกษา, Personal Brand"
          value={niche} onChange={(e) => setNiche(e.target.value)} />
        <div className="chip-row">
          {NICHES.map((n) => (
            <button key={n} className={`chip ${niche === n ? "on" : ""}`}
              onClick={() => setNiche(niche === n ? "" : n)}>{n}</button>
          ))}
        </div>
        <div className="label">แพลตฟอร์มที่จะใช้</div>
        <div className="chip-row">
          {PLATFORMS.map((p) => (
            <button key={p.key} className={`chip ${platforms.includes(p.key) ? "on" : ""}`}
              onClick={() =>
                setPlatforms((prev) =>
                  prev.includes(p.key)
                    ? prev.filter((x) => x !== p.key)
                    : [...prev, p.key]
                )
              }>
              {platforms.includes(p.key) ? "✓ " : ""}{p.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
            disabled={!topic.trim() || !platforms.length || !!loading} onClick={generate}>
            {loading ? <><span className="spin" /> {loading}</> : "🚀 เริ่มสร้าง Content"}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error} · เครดิตไม่ถูกหัก ลองใหม่ได้เลย</p>}
      </div>

      {kit && (
        <>
          {/* Hook */}
          <div className="card">
            <div className="section-head">
              <h3>🎣 Hook</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => activeHook && copy(activeHook.text)}>คัดลอก</button>
                <button className="btn sm" onClick={() => sectionRefine("hook")}>✏️ ปรับ</button>
              </div>
            </div>
            <div className="chip-row">
              {HOOK_TYPES.map((h) => (
                <button key={h.key} className={`chip ${activeHookType === h.key ? "on" : ""}`}
                  onClick={() => setActiveHookType(h.key)}>{h.label}</button>
              ))}
            </div>
            <div className="caption-box">{activeHook?.text}</div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setShowAllHooks(!showAllHooks)}>
              {showAllHooks ? "▼" : "▶"} ดูตัวเลือกอื่น ({kit.hooks.length - 1})
            </button>
            {showAllHooks && kit.hooks.filter((h) => h !== activeHook).map((h, i) => (
              <div key={i} className="caption-box" style={{ marginTop: 8, cursor: "pointer" }}
                onClick={() => setActiveHookType(h.type)}>
                <span className="dim">[{h.type}]</span> {h.text}
              </div>
            ))}
          </div>

          {/* Script */}
          <div className="card">
            <div className="section-head">
              <h3>📝 Script</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => copy(kit.scripts[scriptTab]?.caption ?? "")}>คัดลอก caption</button>
                <button className="btn sm" onClick={() => sectionRefine("script")}>✏️ ปรับ</button>
              </div>
            </div>
            <div className="tabs">
              {kit.scripts.map((s, i) => (
                <button key={s.platform} className={`tab ${scriptTab === i ? "on" : ""}`}
                  onClick={() => setScriptTab(i)}>{s.platform}</button>
              ))}
            </div>
            <div className="dim" style={{ marginBottom: 6 }}>CAPTION พร้อมโพสต์</div>
            <div className="caption-box">{kit.scripts[scriptTab]?.caption}</div>
            {kit.scripts[scriptTab]?.notes && (
              <p className="dim">💡 {kit.scripts[scriptTab]?.notes}</p>
            )}
          </div>

          {/* Visual Prompts */}
          <div className="card">
            <div className="section-head">
              <h3>🎨 Visual Prompts</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => sectionRefine("visual")}>✏️ ปรับ</button>
              </div>
            </div>
            <div className="tabs">
              <button className={`tab ${visualTab === "cover" ? "on" : ""}`} onClick={() => setVisualTab("cover")}>Cover</button>
              <button className={`tab ${visualTab === "ill" ? "on" : ""}`} onClick={() => setVisualTab("ill")}>ภาพประกอบ ({kit.visual.illustrations.length})</button>
              <button className={`tab ${visualTab === "video" ? "on" : ""}`} onClick={() => setVisualTab("video")}>Video (prompt) ({kit.visual.video_prompts.length})</button>
            </div>
            {visualTab === "cover" && (
              <div>
                <p><span className="pill">{kit.visual.cover.base_aspect} → {kit.visual.cover.crop_hint}</span> <b>{kit.visual.cover.label}</b></p>
                <div className="prompt-box">{kit.visual.cover.prompt_en}</div>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => copy(kit.visual.cover.prompt_en)}>คัดลอก Prompt</button>
              </div>
            )}
            {visualTab === "ill" && kit.visual.illustrations.map((ill, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <p className="dim">ประกอบประเด็น: {ill.matches_point}</p>
                <div className="prompt-box">{ill.prompt_en}</div>
                <button className="btn sm" style={{ marginTop: 6 }} onClick={() => copy(ill.prompt_en)}>คัดลอก</button>
              </div>
            ))}
            {visualTab === "video" && kit.visual.video_prompts.map((v) => (
              <div key={v.shot} style={{ marginBottom: 10 }}>
                <p className="dim">Shot {v.shot} · ~{v.duration_s}s</p>
                <div className="prompt-box">{v.prompt_en}</div>
              </div>
            ))}
          </div>

          {/* Hashtags */}
          <div className="card">
            <div className="section-head">
              <h3># Hashtags</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => copy(kit.hashtags.map((h) => h.tags.join(" ")).join("\n"))}>คัดลอกทั้งหมด</button>
                <button className="btn sm" onClick={() => sectionRefine("hashtags")}>✏️ ปรับ</button>
              </div>
            </div>
            {kit.hashtags.map((h) => (
              <div key={h.platform}>
                <span className="dim">{h.platform}: </span>
                <div className="chip-row">
                  {h.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Status + refine-all */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b>พร้อมใช้งาน 4/4 ส่วน</b>
              <div className="dim">Hook · Script · Visual · Hashtags</div>
            </div>
            <button className="btn primary" onClick={() =>
              copy([activeHook?.text, ...kit.scripts.map((s) => `--- ${s.platform} ---\n${s.caption}`),
                kit.hashtags.map((h) => h.tags.join(" ")).join("\n")].join("\n\n"))
            }>📋 คัดลอกทั้งหมด</button>
          </div>

          <div className="card">
            <h3>🎨 ปรับทั้งหมดในครั้งเดียว</h3>
            <p className="dim">พิมพ์รวมๆ เพื่อปรับทุก section — หรือระบุเจาะจงก็ได้ เช่น &quot;ปรับ caption Facebook ให้สั้นลง&quot;, &quot;ปรับ hashtag&quot;</p>
            <textarea className="input" rows={2}
              placeholder="เช่น 'ทำให้กระชับขึ้นทุกอัน' หรือเจาะจง 'ปรับ caption Facebook ให้สั้นลง'"
              value={refineText} onChange={(e) => setRefineText(e.target.value)} />
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <button className="btn primary" disabled={!refineText.trim() || !!loading}
                onClick={() => refineAll()}>
                {loading ? <><span className="spin" /> {loading}</> : "🚀 ปรับทั้งหมด"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense>
      <StudioInner />
    </Suspense>
  );
}
