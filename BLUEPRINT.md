# CREATOR STUDIO — Master Blueprint (Handover Pack)

> **Purpose of this pack**: A complete, self-contained specification for building an AI-powered
> Creator Studio for the Thai SME / creator market. It is written so that a *less capable
> coding model* (Claude Opus / Sonnet) can build the product milestone-by-milestone **without
> inventing anything critical itself** — every AI prompt, JSON schema, screen, table, and
> pipeline is specified here.
>
> **Product reference**: Modeled on the workflows observed in Hero AI (app.heroaiengine.com +
> studio.heroaiengine.com). We are building our **own product** in the same category — do NOT
> copy their brand name, logo, or verbatim UI copy. All Thai UI strings in this pack are
> functional placeholders you may rewrite. Product codename: **"Creator Studio"**.

---

## 0. The One-Paragraph Pitch

Two connected apps, one account, one credit wallet:

1. **Content Engine** (`app.<domain>`) — a Thai-first AI content workspace. User types a topic
   (or picks a viral trend template), presses one button, and gets a complete, ready-to-post
   kit: 5 hooks (different psychological angles), platform-formatted captions, English
   image/video prompts, a generated cover image, and hashtags — all refinable per-section or
   all-at-once with plain-Thai instructions. Brand Voice and Style Cloner lock the output to
   the user's identity. Everything lands in My Works / Folders / Content Calendar.

2. **Creator Studio** (`studio.<domain>`) — a faceless-video factory. Paste a script (or upload
   a clip) → AI voiceover (Gemini TTS / ElevenLabs) → auto B-roll from stock (Pexels/Pixabay)
   matched per script segment → background render → a caption studio with viral preset styles
   (Hormozi, Beast, karaoke…) where edits preview instantly without re-render → export burns
   captions into the final 9:16 file. Also exposes an **MCP server** so Claude/agents can drive
   video creation programmatically.

**The moat is the prompt layer** (doc 02): every button is a carefully engineered prompt +
strict JSON schema + model router. The UI is thin; the prompts are the product.

---

## 1. Pack Contents (read in this order)

| Doc | File | What it contains | Build phase |
|---|---|---|---|
| 00 | `BLUEPRINT.md` (this file) | Architecture, stack, principles, handover protocol | read first |
| 01 | `docs/01-product-spec.md` | Every screen & feature of both apps, exact behaviors | all |
| 02 | `docs/02-prompt-engine.md` | **THE CORE** — every button → prompt template + JSON schema + model routing + refine loops | M2+ |
| 03 | `docs/03-data-model.md` | Postgres schema, credits ledger, jobs, RLS rules | M1 |
| 04 | `docs/04-video-pipeline.md` | Studio render pipeline: TTS, alignment, B-roll, captions, export, MCP server | M5-M7 |
| 05 | `docs/05-ui-design-system.md` | Design tokens, components, screen-by-screen layout specs | all |
| 06 | `docs/06-build-plan.md` | Milestones M0–M8 with acceptance tests for the executing model | all |

---

## 2. Tech Stack (decided — do not re-litigate)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 App Router**, TypeScript | Matches owner's existing stack & skills |
| DB/Auth/Storage | **Supabase** (Postgres + RLS + Auth + Storage) | One backend for both apps |
| Background jobs | **Supabase queue table + worker** (Node worker on Railway/Fly) or Inngest | Video renders are minutes-long; must survive tab close |
| AI text | **Gemini 2.5 Flash** (free tier default), Gemini 2.5 Pro for refine-all & brand analysis | Cost: free tier = growth engine. Abstract behind a provider interface so Claude API can slot in |
| AI images | **Gemini image models**: standard (cheap, 1 credit) + pro model capable of rendering Thai text (5 credits). Marketed as e.g. "Banana" tiers | Thai-text-in-image is the killer differentiator |
| TTS | **Gemini TTS** (bundled voices: Aoede etc.) default; **ElevenLabs** BYO-voiceId option | Zero-setup default, pro option |
| STT + word timestamps | Whisper (large-v3 via API or self-host) or Gemini audio | Needed for caption alignment & upload-own-clip mode |
| Avatar (optional, later) | HeyGen API (billed per second) | Phase 2 of studio |
| Stock B-roll | **Pexels API + Pixabay API — user supplies own free keys** | Keys are free; shifts quota to user; settings UI validates keys |
| Video render | **Remotion** (React-based, caption styling = React components) running in worker; ffmpeg for mux/trim | Caption presets map 1:1 to React components |
| Payments | Stripe (or Omise for THB local cards/PromptPay) | Credit packs + subscriptions in ฿ |
| MCP server | `/api/mcp` route implementing MCP streamable-HTTP + OAuth | Lets Claude / agents drive the studio |

**Repo layout** (monorepo):

```
creator-studio/
├── apps/
│   ├── content/        # app.<domain>  — Content Engine (Next.js)
│   ├── studio/         # studio.<domain> — Video studio (Next.js)
│   └── worker/         # render + generation job worker (Node)
├── packages/
│   ├── prompts/        # ⭐ ALL prompt templates + schemas (doc 02) as typed TS modules
│   ├── ai/             # provider router (gemini/claude/elevenlabs/...), retry, JSON-repair
│   ├── db/             # supabase types, queries, credit ledger functions
│   └── ui/             # shared design system components (doc 05)
└── docs/               # this pack
```

---

## 3. Non-Negotiable Engineering Principles

These are the rules the executing model must follow. They encode *why the reference product
feels good*.

### P1 — Prompts live in code, versioned, never inline
Every prompt is a typed module in `packages/prompts/` exporting:
```ts
export const contentKit = {
  id: "content.kit.v1",            // version in the id — bump, never mutate
  model: "gemini-2.5-flash",       // default routing
  temperature: 0.8,
  system: (ctx: Ctx) => `...`,     // template fn, NOT string concat in route handlers
  user: (input: Input) => `...`,
  schema: ContentKitSchema,        // zod schema — the contract
}
```
Generation results store `prompt_id` + raw model output. This makes every output reproducible
and debuggable.

### P2 — Every generation returns STRICT JSON validated by zod
- Use the model's native JSON mode / `responseSchema` where available.
- On parse failure: 1 automatic repair attempt (send the broken output back with "fix to match
  schema"), then fail the job with a user-friendly Thai error. Never render unvalidated output.

### P3 — Thai for humans, English for image/video models
All user-facing copy, captions, scripts, hooks, hashtags → **Thai** (unless user's input is
another language). All image prompts, video prompts, B-roll search keywords → **English**
(stock APIs and image models perform dramatically better), except literal Thai text that must
appear *inside* an image, which stays Thai wrapped in quotes with the "no other letters" guard
(see doc 02 §V).

### P4 — Generate once, refine forever
Every generated section carries three actions: **copy / regenerate / refine (ปรับ)**, plus a
global **refine-all** box. Refine calls send the *previous JSON* + the user instruction and
must return the same schema with untouched sections byte-identical (doc 02 §R).

### P5 — Everything the AI makes is a remixable asset
Every generation is saved with `{prompt_used, model, credits_spent, params}` and can be
(a) viewed in My Works, (b) featured in Inspiration with its prompt **publicly visible**, and
(c) one-click "ใช้ใน Studio" → re-opens the studio with all fields pre-filled. The prompt
transparency *is* the education layer and the growth loop.

### P6 — Credits are a ledger, not a counter
Single `credit_transactions` table; balance = SUM. Every AI call debits atomically **before**
the provider call and refunds on failure. Costs are configured in a `model_costs` table, shown
in the UI *before* the user clicks (e.g. "ใช้ 1 · เหลือ 31"). See doc 03 §4.

### P7 — Long work is a background job with a resumable UI
Render/generation jobs: `queued → running(progress%) → done | failed(reason)`. The UI must
survive tab-close and show a notification badge on return. Job progress text is specific
("กำลังฝังซับ 34%"), not generic spinners.

### P8 — Caption edits never trigger re-render
The studio renders a **base video** (voice + B-roll + music, no captions). Captions are a JSON
overlay previewed live in the browser (same React components Remotion uses). Export = burn
overlay onto base. This one architectural decision creates the "แก้ซับเห็นผลทันที" magic.

### P9 — Daily free quota + BYO key = growth engine
Free tier: N generations/day on house Gemini key ("เหลือ 30 ครั้งวันนี้"). Users may add their
own provider API keys → unlimited (their cost). Keys stored encrypted (Supabase vault),
validated with a live test call on save ("ทดสอบ" button).

### P10 — Buddhist-era dates, Thai-first UX
Dates display พ.ศ. (e.g. 2569). Numbers/timers in Thai conventions. Tone of UI copy: friendly,
เป็นกันเอง, no corporate stiffness. Emoji used sparingly but warmly (🚀 ✨ 💡).

---

## 4. System Architecture (one diagram)

```
┌─────────────────────────────┐      ┌───────────────────────────────┐
│  app.<domain>  (Content)    │      │  studio.<domain>  (Video)     │
│  Next.js — Vercel           │      │  Next.js — Vercel             │
│                             │      │   └── /api/mcp  (MCP server)  │
└──────────┬──────────────────┘      └──────────┬────────────────────┘
           │  server actions / route handlers   │
           ▼                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Supabase (shared)                           │
│  auth · postgres (RLS) · storage (renders, images, uploads)        │
│  tables: users, brands, styles, generations, jobs, credits, ...    │
└──────────┬─────────────────────────────────────────────────────────┘
           │ jobs table (queue)
           ▼
┌────────────────────────────────────────────────────────────────────┐
│  worker (Node, Railway/Fly — NOT serverless)                       │
│  • content generations that exceed serverless timeout              │
│  • video pipeline: TTS → align → B-roll fetch → Remotion render    │
│  • export: burn captions → mp4 → storage → notify                  │
└──────────┬─────────────────────────────────────────────────────────┘
           ▼
   Gemini (text/image/TTS) · ElevenLabs · Whisper · Pexels · Pixabay
   · HeyGen (phase 2) · Stripe/Omise
```

---

## 5. Handover Protocol (how to drive Opus/Sonnet with this pack)

Give the executing model these standing instructions, verbatim:

1. **Work one milestone at a time** from `docs/06-build-plan.md`. Do not start Mn+1 until Mn's
   acceptance tests pass.
2. **Never invent prompts.** Use the templates in `docs/02-prompt-engine.md` verbatim,
   implemented as modules per P1. If a needed prompt is missing, stop and ask — do not
   improvise one.
3. **Never invent schemas.** zod schemas in doc 02/03 are the contract. UI renders from the
   schema; DB stores the schema.
4. **After each feature**: run the doc-06 acceptance test for it, show the actual output
   (screenshot or JSON), and state pass/fail honestly.
5. **When output quality looks poor**, the fix order is: (a) check schema validation is on,
   (b) check the right model tier was routed, (c) check context blocks (brand/style) were
   injected — only then report back. Do not freelance-edit prompt wording; propose a diff.
6. Keep all UI strings in a single `th.ts` locale file — Thai copy will be revised by a human.
7. Secrets: only in env / Supabase vault. Never log full prompts containing user API keys.

---

## 6. What Was Verified From the Reference Product (evidence base)

So the executing model trusts the spec: these behaviors were directly observed in the
reference product (31 screenshots + live session, 2026-07-08):

- Content Studio input: topic textarea + 7 template chips + niche free-text + 12 niche chips +
  platform selector (FB/IG/TikTok/YouTube/TTS) + Brand/Style dropdowns → one "เริ่มสร้าง Content" button.
- Output page sections, in order: **Hook** (type chips: อัตโนมัติ/คำถาม/FOMO/เรื่องเล่า/สถิติ-ตัวเลข,
  active text + "ดูตัวเลือกอื่น (4)") → **Script** (per-platform tabs, "CAPTION พร้อมโพสต์" with copy) →
  **Visual Prompts** (tabs: Cover / ภาพประกอบ (3) / Video (prompt) (8); cover labeled "2:3 → crop 4:5 —
  Cover Feed (FB/IG)"; prompt in English; inline image generation with Thai-text checkbox: Standard
  1 credit vs Pro 5 credits) → **Hashtags** (5, per-platform) → status "พร้อมใช้งาน 4/4 ส่วน" +
  copy-all → **ปรับทั้งหมดในครั้งเดียว** free-text refine box. Every section: copy/regenerate/ปรับ.
- Observed English cover prompt style (structure to emulate — subject, action, setting, lighting,
  mood, screen-content guard, background, composition safe-zone): *"A close-up shot of a young,
  confident Thai professional (male, 30s) in a modern co-working space in Bangkok, smiling slightly
  while looking at a laptop screen… Soft, diffused natural light… The laptop screen shows a subtle,
  abstract representation of AI interface elements, not specific text. The background is softly
  blurred… ⚠ Subject's face and laptop screen focused in the middle 70% of the frame. Top 15% and
  bottom 15% are clear of critical elements, allowing for social media UI overlays or cropping
  without losing impact."*
- Observed product-shot prompt style (Inspiration page, model "Nano Banana Pro", 5 credits, tier
  premium): *"A single packet of "ก๋วยเตี๋ยวเรือ เลอรส" instant boat noodles, red packaging with
  "เส้นเล็ก" text, floating heroically in a clean, brightly lit kitchen… Cinematic soft lighting,
  shallow depth of field. Ultra high quality render, aspect ratio 9:16. Absolutely no text, no
  promotional banners, no letters other than what is physically printed on the product packaging."*
- Viral Studio: 67 templates in 5 categories (คลิป 3D 9 · ภาพไวรัล 37 · เกาะกระแส 13 · สินค้าโฆษณา 6 ·
  เพลง AI 2) with usage counts, HOT/NEW/Featured badges, search, sort (แนะนำ/มาใหม่/กำลังฮิต).
  Template detail = example output + small form (theme/business required; object optional "AI
  เลือกให้"; dropdowns e.g. speaking style: กู-มึง เดือดจัด / แกร่งแต่สุภาพ / น่าสงสาร / ตลกร้าย; video
  length; content count) + "สร้าง Output". Daily quota banner: "เหลือ 30 ครั้งวันนี้ — เพิ่ม API Key
  เพื่อใช้ไม่จำกัด". Footer tip: "Copy prompt ไปวางใน ChatGPT, Gemini, Midjourney หรือ AI ตัวไหนก็ได้".
- Brand Voice onboarding: 4-step wizard (เล่าให้ AI ฟัง → ตรวจ+บันทึก → ใส่รูปแบรนด์ → เสร็จ), free-text
  Thai story + starter chips ("ฉันขาย __ ให้ลูกค้า __" etc.) → "ให้ AI กรอกให้" fills structured fields
  (โทนการพูด, กลุ่มลูกค้า, คำที่ใช้, แฮชแท็ก) in ~5s; manual mode available.
- Visual Studio: brand-image generator ("ตั้งแบรนด์คุณใน 30 วินาที" — logo/photo/shop sign/banner
  auto-injected into templates), free prompt box + ref image + niche chip + model picker showing
  credit cost + aspect picker + remaining-credit counter; 72 templates filtered by business type /
  uses-brand-image / Thai-text; recent works strip.
- Dashboard (Content): greeting, quick-start input with 2 example placeholders, 3 alt actions
  (เทรนด์ไวรัล/หาไอเดียก่อน/ตั้ง Brand), usage line "ใช้ 9/30 วันนี้ · 0 ทั้งหมด · 0 brands · 0 styles",
  4-item onboarding checklist with progress, continue-last-work card, recent works, trending
  templates with usage counts, Hero-of-the-week (public prompt visible), example gallery with
  "กดที่ใบไหนได้เพื่อดูวิธีสร้าง".
- Header meta: brand pill ("ไม่ตั้งแบรนด์"), model pill ("Gemini 2.5 Flash · ฟรี"), streak ("2 วันติด"),
  credits ("31 เครดิต"), theme toggle, account with workspace badge.
- Credits: history rows "ใช้เจนรูป -1 · ใช้กับ Image Studio / Viral Studio", packs 100/฿199,
  500/฿899 (save 10%, ยอดนิยม), 1000/฿1,599 (save 20%, คุ้มที่สุด); studio side: 2 เครดิต = 1 นาที,
  packs 200/฿199, 540/฿499 (+8%), 1150/฿999 (+15%); purchased credits permanent.
- Studio dashboard: Pro plan 74/80 นาที + reset date; guide box (80 min/month; Gemini managed —
  only Pexels/Pixabay keys needed; overflow → buy credits); Business plan: 150 min/mo, 10 min/clip,
  14-day retention, priority support.
- Studio editor stepper: 01 สคริปต์ → 02 องค์ประกอบ → 03 แต่งซับ.
  - Step 1: two modes (พิมพ์สคริปต์ / ใช้คลิปที่ถ่ายเอง); textarea "ขึ้นบรรทัดใหม่ = แยกเซ็กเมนต์"; live
    counter "20 คำ · 2 เซ็กเมนต์ · คลิปยาว ~0:07"; right rail = draggable typed segment cards, first
    line auto-typed **HOOK** with per-card time ranges.
  - Step 2: B-roll tiers (ฟรีล้วน 0cr / ผสม AI ~6-9cr / AI เต็มที่ ~25-45cr — latter two "เร็วๆ นี้");
    voice tabs Gemini (Aoede — Female · Breezy, ฟังตัวอย่าง) / ElevenLabs; music mood chips with
    inline preview (Classical-Ambient-Cinematic·แนะนำ, Hip-Hop-Funk…, ไม่ใส่เพลง) + "คลังเพลงทั้งหมด
    (22) · อัปโหลดเพลงของคุณ"; avatar (มีอวตาร HeyGen per-second / Faceless); right rail = settings
    summary + "เรนเดอร์วิดีโอ" + cost preview "ใช้ ~1 จาก 74 นาทีที่เหลือ · แก้ทุกอย่างได้ทีหลัง".
  - Step 3 (caption studio): card list (154 cards for 5:41 clip) with time ranges + inline edit +
    merge ("รวมกับใบถัดไป")/split ("แยกการ์ด"); right panel: caption length (1 ประโยค / ≤4 / ≤3 / ≤2
    คำ + "ซับสั้นเด้งเร็วแบบ TikTok" warning that changing re-chunks); 4 recommended styles
    (เด้งไวรัล, เงาเข้ม, ขอบหนา, มินิมอล); 6 tweakable effects (มาตรฐาน/มินิมอล/ตัวหนาเด่น/คาราโอเกะ/
    ป๊อปไลน์/เส้นขอบชัด); 11 style themes (นีออนเขียว, พาสเทล, คลาสสิก, Hormozi, Beast, กล่องขาว,
    กล่องเหลือง, เรโทร, ข่าว, ไฟแดง, ไฟฟ้า); text effects (ป๊อป, เด้ง, เฟด, สั้น, เรืองแสง, สไลด์,
    หมุนซูม, ไฮไลท์, คาราโอเกะ, พิมพ์ดีด); font row (Kanit — หนา/บาง, size 80px slider); scope
    (ทั้งคลิป / การ์ดที่เลือก); text colors + HOOK·CTA emphasis colors; shadow/outline toggles+slider;
    vertical position slider (88%) + บน/กลาง/ล่าง; tips "ลากซับบนจอเพื่อปรับตำแหน่ง · Space เล่น/หยุด ·
    ←/→ ขยับ 1 วิ · Ctrl+Z เลิกทำ".
  - Timeline tracks: เสียงพูด (waveform) · บีโรล (English keyword chips per segment: "digital
    interface glitch", "creative block frustration", "upload image 3d model"…) · ซับไทย (caption
    chips) · เพลง ("♪ ลดเสียงใต้เสียงพูดอัตโนมัติ"). Transport: play, time, เลิกทำ, Snap, zoom.
  - Render banner: "เรนเดอร์เสร็จแล้ว · แก้ซับเห็นผลทันที ไม่ต้องเรนเดอร์ใหม่" + "เรนเดอร์ใหม่" +
    progress button "กำลังฝังซับ 3%" during export.
- Settings (studio): tabs Profile / API Keys / Agent-MCP / Billing. API Keys: status banner
  "พร้อมสร้างวิดีโอ", required = Pexels + Pixabay (ฟรี badges, need ≥1, eye/test/delete per key),
  collapsed "ขั้นสูง (ไม่บังคับ) — ไม่ใส่ก็ใช้งานได้". Agent/MCP: endpoint
  `https://studio.<domain>/api/mcp`, agent picker (Claude / Claude Code / Codex / OpenClaw /
  Hermes), per-agent connect instructions (Claude: Settings → Connectors → Add custom connector →
  paste URL → OAuth login, no token), access-token section for token-based agents.
- Docs/help center (studio): sections เริ่มต้นใช้งาน / ตั้งค่าคีย์ API / สร้างวิดีโอ / ซับไทย / พิธีกร AI
  (Avatar) / นาที & เครดิต / แก้ปัญหา & FAQ. Key facts: 9:16 layout for TikTok/Reels; B-roll changes
  every 3–5s auto-matched per segment; 2 modes (script / own clip — own clip keeps original audio
  continuous, transcribes to aligned Thai subs, inserts B-roll alternating); render-in-background
  then style captions then export burns them.

Everything above must exist in our build. Where this pack goes beyond the observed product
(e.g. exact prompt wording), it is engineering judgment — treat doc 02 as the source of truth.

---

## 7. Glossary (Thai UI terms used throughout the pack)

| Thai | Meaning here |
|---|---|
| สร้างคอนเทนต์ | generate content (the main CTA) |
| ปรับ | refine (send instruction, patch output) |
| แต่งซับ | caption styling step |
| เซ็กเมนต์ / การ์ดซับ | script segment / caption card |
| บีโรล | B-roll |
| เสียงพากย์ | voiceover |
| องค์ประกอบ | elements/composition (voice+music+broll+avatar) |
| เรนเดอร์เบื้องหลัง | background render |
| ส่งออกวิดีโอ | export (burn captions) |
| เครดิต / นาที | credits (images etc.) / minutes (video quota) |
| แบรนด์ / สไตล์ | Brand Voice / cloned writing Style |
