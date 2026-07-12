"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserClient, getGeneration, isSupabaseConfigured, type BrandRow, type StyleRow } from "@cs/db";
import { RECIPE_GROUPS, TEMPLATE_CHIPS, type ContentKit, type ContentKitInput, type Platform, type TemplateChip } from "@cs/prompts";
import { CampaignPanel } from "./CampaignPanel";
import { useT, useLang } from "../LangProvider";

// Per-chip icon (presentation only — TEMPLATE_CHIPS/RECIPE_GROUPS in @cs/prompts stay
// the source of truth for names/structure/grouping; M15 "Content Recipes" redesign).
const CHIP_ICONS: Record<TemplateChip, string> = {
  portfolio: "💼", day_in_life: "📅", new_product: "✨", honest_review: "⭐",
  before_after: "🔄", five_tips: "💡", promotion: "🔥",
  sales_post: "🛍️", flash_sale: "⚡", customer_story: "💬",
  myth_bust: "❌", how_to: "🧭", behind_scenes: "🎬", q_and_a: "❓",
};
const NICHES = [
  { th: "ทั่วไป", en: "General" }, { th: "ขายของออนไลน์", en: "Online store" }, { th: "ร้านอาหาร", en: "Restaurant" },
  { th: "อสังหาริมทรัพย์", en: "Real estate" }, { th: "การเงิน-ลงทุน", en: "Finance/Investing" }, { th: "สุขภาพ-ความงาม", en: "Health/Beauty" },
  { th: "การศึกษา-คอร์ส", en: "Education/Courses" }, { th: "ฟรีแลนซ์-บริการ", en: "Freelance/Services" }, { th: "เกษตร-OTOP", en: "Agriculture/OTOP" },
  { th: "ช่าง-รับเหมา", en: "Contractor/Trades" }, { th: "ท่องเที่ยว-โรงแรม", en: "Travel/Hotel" }, { th: "Personal Brand", en: "Personal Brand" },
];
const PLATFORMS: { key: Platform; th: string; en: string }[] = [
  { key: "facebook", th: "Facebook", en: "Facebook" },
  { key: "instagram", th: "Instagram", en: "Instagram" },
  { key: "tiktok", th: "TikTok", en: "TikTok" },
  { key: "youtube", th: "YouTube", en: "YouTube" },
  { key: "tts", th: "TTS (เสียง)", en: "TTS (audio)" },
];
const HOOK_TYPES: { key: string; th: string; en: string }[] = [
  { key: "auto", th: "✨ อัตโนมัติ", en: "✨ Auto" },
  { key: "question", th: "❓ คำถาม", en: "❓ Question" },
  { key: "fomo", th: "🔥 FOMO", en: "🔥 FOMO" },
  { key: "story", th: "📖 เรื่องเล่า", en: "📖 Story" },
  { key: "stat", th: "📊 สถิติ-ตัวเลข", en: "📊 Stat/Number" },
];

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

interface BrainstormIdea {
  title: string;
  angle: string;
  hook_preview: string;
  format: string;
}

function StudioInner() {
  const params = useSearchParams();
  const t = useT();
  const { lang } = useLang();
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [niche, setNiche] = useState("");
  // Deep-link from Campaign Mode's week grid ("สร้างโพสต์เต็ม →") pre-selects the
  // day's recipe chip too, not just the topic — same param convention as ?topic=.
  const [template, setTemplate] = useState<TemplateChip | undefined>(() => {
    const t = params.get("template");
    return t && t in TEMPLATE_CHIPS ? (t as TemplateChip) : undefined;
  });
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
  const [coverThaiText, setCoverThaiText] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<{ url: string; creditsSpent: number } | null>(null);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [stylesList, setStylesList] = useState<StyleRow[]>([]);
  const [brandId, setBrandId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [ideas, setIdeas] = useState<BrainstormIdea[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const db = browserClient();
    db.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      db.from("brands").select("*").then(({ data: b }) => setBrands((b ?? []) as BrandRow[]));
      db.from("styles").select("*").then(({ data: s }) => setStylesList((s ?? []) as StyleRow[]));
    });
  }, []);

  // Reopen a previously-generated kit from /history ("เปิดดู →" links here with
  // ?jobId=<generation id>) instead of re-running the AI — the full output was
  // already persisted by /api/generate and just needs to be read back.
  useEffect(() => {
    const jobId = params.get("jobId");
    if (!jobId || !isSupabaseConfigured()) return;
    setHydrating(true);
    setHydrateError(null);
    const db = browserClient();
    getGeneration(db, jobId)
      .then((gen) => {
        if (!gen || gen.type !== "content_kit") {
          // Not found (deleted row, bad id) or not a content_kit row — don't
          // pretend nothing happened; the user came here expecting saved
          // content, so a blank form with no explanation would look broken.
          setHydrateError(t("studio.load_saved_not_found"));
          return;
        }
        const input = gen.input as Partial<ContentKitInput>;
        setTopic(input.topic ?? gen.title ?? "");
        setNiche(input.niche ?? "");
        if (input.platforms?.length) setPlatforms(input.platforms);
        if (input.template && input.template in TEMPLATE_CHIPS) setTemplate(input.template);
        setKit(gen.output as ContentKit);
        setGenerationId(gen.id);
      })
      // getGeneration throws on a real Postgrest/network error (vs. returning
      // null for "not found") — surface it instead of failing silently.
      .catch(() => setHydrateError(t("studio.load_saved_error")))
      .finally(() => setHydrating(false));
    // Only ever reopen once, off the jobId present at first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setLoading(t("studio.generating"));
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, niche: niche || undefined, template, platforms, brandId: brandId || undefined, styleId: styleId || undefined }),
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

  async function getIdeas() {
    const seed = topic.trim() || niche.trim();
    if (!seed) return;
    setIdeasLoading(true);
    setIdeasError(null);
    setIdeas(null);
    try {
      const res = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic_or_niche: seed, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.ideas);
    } catch (e) {
      setIdeasError((e as Error).message);
    } finally {
      setIdeasLoading(false);
    }
  }

  function pickIdea(idea: BrainstormIdea) {
    setTopic(idea.title);
    setIdeas(null);
  }

  async function refineAll(section?: "hook" | "script" | "visual" | "hashtags", instruction?: string) {
    const inst = instruction ?? refineText;
    if (!kit || !inst.trim()) return;
    setLoading(section ? `${t("studio.refining_section")} ${section}…` : t("studio.refining_all"));
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
    const inst = window.prompt(t("studio.refine_prompt_ask"));
    if (inst) void refineAll(section, inst);
  }

  async function generateCover() {
    if (!kit) return;
    setCoverLoading(true);
    setCoverError(null);
    try {
      const validAspects = ["1:1", "4:5", "9:16", "16:9", "2:3"];
      const aspect = validAspects.includes(kit.visual.cover.base_aspect)
        ? kit.visual.cover.base_aspect
        : "4:5";
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: kit.visual.cover.prompt_en,
          aspect,
          thai_text_mode: coverThaiText,
          skip_enhance: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverImage({ url: data.url, creditsSpent: data.creditsSpent });
    } catch (e) {
      setCoverError((e as Error).message);
    } finally {
      setCoverLoading(false);
    }
  }

  const activeHook =
    kit?.hooks.find((h) => h.type === activeHookType) ??
    kit?.hooks.find((h) => h.is_recommended) ??
    kit?.hooks[0];

  return (
    <div>
      <h1>{t("studio.title")}</h1>
      {hydrating && <p className="dim">{t("studio.loading_saved")}</p>}
      {hydrateError && <p style={{ color: "var(--danger)" }}>{hydrateError}</p>}
      <div className="card">
        <div className="label">{t("studio.topic_label")}</div>
        <textarea
          className="input" rows={2}
          placeholder={
            template
              ? (lang === "th" ? TEMPLATE_CHIPS[template].topic_hint_th : TEMPLATE_CHIPS[template].topic_hint_en)
              : t("studio.topic_placeholder")
          }
          value={topic} onChange={(e) => setTopic(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button className="btn sm" disabled={!topic.trim() && !niche.trim() || ideasLoading} onClick={getIdeas}>
            {ideasLoading ? <><span className="spin" /> {t("studio.brainstorm_loading")}</> : t("studio.brainstorm_btn")}
          </button>
          <span className="dim" style={{ fontSize: 12 }}>{t("studio.brainstorm_hint")}</span>
        </div>
        {ideasError && <p style={{ color: "var(--danger)" }}>{ideasError}</p>}
        {ideas && (
          <div style={{ marginTop: 10 }}>
            <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>{t("studio.brainstorm_pick")}</div>
            {ideas.map((idea, i) => (
              <div key={i} className="caption-box" style={{ marginBottom: 8, cursor: "pointer" }}
                role="button" tabIndex={0}
                onClick={() => pickIdea(idea)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickIdea(idea);
                  }
                }}>
                <b>{idea.title}</b>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{idea.angle} · {idea.format}</div>
              </div>
            ))}
          </div>
        )}
        <div className="label" style={{ marginTop: 14 }}>{t("studio.recipes_label")}</div>
        {RECIPE_GROUPS.map((g) => (
          <div key={g.group_th} style={{ marginBottom: 4 }}>
            <div className="dim" style={{ fontSize: 12, margin: "6px 0 4px" }}>{g.icon} {lang === "th" ? g.group_th : g.group_en}</div>
            <div className="chip-row" style={{ marginTop: 0 }}>
              {g.chips.map((key) => (
                <button key={key} className={`chip ${template === key ? "on" : ""}`}
                  onClick={() => setTemplate(template === key ? undefined : key)}>
                  {CHIP_ICONS[key]} {lang === "th" ? TEMPLATE_CHIPS[key].name_th : TEMPLATE_CHIPS[key].name_en}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="label">{t("studio.niche_label")} <span className="dim">{t("studio.niche_optional")}</span></div>
        <input className="input" placeholder={t("studio.niche_placeholder")}
          value={niche} onChange={(e) => setNiche(e.target.value)} />
        <div className="chip-row">
          {NICHES.map((n) => (
            <button key={n.th} className={`chip ${niche === n.th ? "on" : ""}`}
              onClick={() => setNiche(niche === n.th ? "" : n.th)}>{lang === "th" ? n.th : n.en}</button>
          ))}
        </div>
        <div className="label">{t("studio.platforms_label")}</div>
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
              {platforms.includes(p.key) ? "✓ " : ""}{lang === "th" ? p.th : p.en}
            </button>
          ))}
        </div>
        {(brands.length > 0 || stylesList.length > 0) && (
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="label">{t("studio.brand_voice_label")}</div>
              <select className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">{t("studio.brand_voice_none")}</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div className="label">{t("studio.style_label")}</div>
              <select className="input" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                <option value="">{t("studio.style_none")}</option>
                {stylesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
            disabled={!topic.trim() || !platforms.length || !!loading || hydrating} onClick={generate}>
            {loading ? <><span className="spin" /> {loading}</> : t("studio.generate_btn")}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error} · {t("studio.credit_note")}</p>}
      </div>

      <CampaignPanel topic={topic} niche={niche} />

      {kit && (
        <>
          {/* Hook */}
          <div className="card">
            <div className="section-head">
              <h3>{t("studio.section.hook")}</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => activeHook && copy(activeHook.text)}>{t("studio.copy")}</button>
                <button className="btn sm" onClick={() => sectionRefine("hook")}>{t("studio.refine")}</button>
              </div>
            </div>
            <div className="chip-row">
              {HOOK_TYPES.map((h) => (
                <button key={h.key} className={`chip ${activeHookType === h.key ? "on" : ""}`}
                  onClick={() => setActiveHookType(h.key)}>{lang === "th" ? h.th : h.en}</button>
              ))}
            </div>
            <div className="caption-box">{activeHook?.text}</div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setShowAllHooks(!showAllHooks)}>
              {showAllHooks ? "▼" : "▶"} {t("studio.see_other_hooks")} ({kit.hooks.length - 1})
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
              <h3>{t("studio.section.script")}</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => copy(kit.scripts[scriptTab]?.caption ?? "")}>{t("studio.copy_caption")}</button>
                <button className="btn sm" onClick={() => sectionRefine("script")}>{t("studio.refine")}</button>
              </div>
            </div>
            <div className="tabs">
              {kit.scripts.map((s, i) => (
                <button key={s.platform} className={`tab ${scriptTab === i ? "on" : ""}`}
                  onClick={() => setScriptTab(i)}>{s.platform}</button>
              ))}
            </div>
            <div className="dim" style={{ marginBottom: 6 }}>{t("studio.caption_ready")}</div>
            <div className="caption-box">{kit.scripts[scriptTab]?.caption}</div>
            {kit.scripts[scriptTab]?.notes && (
              <p className="dim">💡 {kit.scripts[scriptTab]?.notes}</p>
            )}
          </div>

          {/* Visual Prompts */}
          <div className="card">
            <div className="section-head">
              <h3>{t("studio.section.visual")}</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => sectionRefine("visual")}>{t("studio.refine")}</button>
              </div>
            </div>
            <div className="tabs">
              <button className={`tab ${visualTab === "cover" ? "on" : ""}`} onClick={() => setVisualTab("cover")}>{t("studio.tab_cover")}</button>
              <button className={`tab ${visualTab === "ill" ? "on" : ""}`} onClick={() => setVisualTab("ill")}>{t("studio.tab_illustrations")} ({kit.visual.illustrations.length})</button>
              <button className={`tab ${visualTab === "video" ? "on" : ""}`} onClick={() => setVisualTab("video")}>{t("studio.tab_video")} ({kit.visual.video_prompts.length})</button>
            </div>
            {visualTab === "cover" && (
              <div>
                <p><span className="pill">{kit.visual.cover.base_aspect} → {kit.visual.cover.crop_hint}</span> <b>{kit.visual.cover.label}</b></p>
                <div className="prompt-box">{kit.visual.cover.prompt_en}</div>
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => copy(kit.visual.cover.prompt_en)}>{t("studio.copy_prompt")}</button>

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={coverThaiText} onChange={(e) => setCoverThaiText(e.target.checked)} />
                  <span className="dim">{t("studio.thai_text_toggle")}</span>
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <span className="pill">{t("studio.use_credits")} {coverThaiText ? 5 : 1} {t("campaign.credits_unit")}</span>
                  <button className="btn primary" disabled={coverLoading} onClick={generateCover}>
                    {coverLoading ? <><span className="spin" /> {t("studio.generating_image")}</> : coverImage ? t("studio.regenerate") : t("studio.generate_this")}
                  </button>
                </div>
                {coverError && <p style={{ color: "var(--danger)" }}>{coverError}</p>}
                {coverImage && (
                  <div style={{ marginTop: 12 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImage.url} alt={kit.visual.cover.label} style={{ maxWidth: "100%", borderRadius: 12, display: "block" }} />
                    <a className="btn sm" style={{ marginTop: 8 }} href={coverImage.url} download target="_blank" rel="noreferrer">{t("studio.download")}</a>
                  </div>
                )}
              </div>
            )}
            {visualTab === "ill" && kit.visual.illustrations.map((ill, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <p className="dim">{t("studio.matches_point")} {ill.matches_point}</p>
                <div className="prompt-box">{ill.prompt_en}</div>
                <button className="btn sm" style={{ marginTop: 6 }} onClick={() => copy(ill.prompt_en)}>{t("studio.copy")}</button>
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
              <h3>{t("studio.section.hashtags")}</h3>
              <div className="section-actions">
                <button className="btn sm" onClick={() => copy(kit.hashtags.map((h) => h.tags.join(" ")).join("\n"))}>{t("studio.copy_all")}</button>
                <button className="btn sm" onClick={() => sectionRefine("hashtags")}>{t("studio.refine")}</button>
              </div>
            </div>
            {kit.hashtags.map((h) => (
              <div key={h.platform}>
                <span className="dim">{h.platform}: </span>
                <div className="chip-row">
                  {h.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Status + refine-all */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b>{t("studio.ready")}</b>
              <div className="dim">Hook · Script · Visual · Hashtags</div>
            </div>
            <button className="btn primary" onClick={() =>
              copy([activeHook?.text, ...kit.scripts.map((s) => `--- ${s.platform} ---\n${s.caption}`),
                kit.hashtags.map((h) => h.tags.join(" ")).join("\n")].join("\n\n"))
            }>{t("studio.copy_everything")}</button>
          </div>

          <div className="card">
            <h3>{t("studio.refine_all_title")}</h3>
            <p className="dim">{t("studio.refine_all_desc")}</p>
            <textarea className="input" rows={2}
              placeholder="เช่น 'ทำให้กระชับขึ้นทุกอัน' หรือเจาะจง 'ปรับ caption Facebook ให้สั้นลง'"
              value={refineText} onChange={(e) => setRefineText(e.target.value)} />
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <button className="btn primary" disabled={!refineText.trim() || !!loading}
                onClick={() => refineAll()}>
                {loading ? <><span className="spin" /> {loading}</> : t("studio.refine_all_btn")}
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
