# 08 — Content Engine Redesign Blueprint (M14–M17)

Handover spec for executing models (Opus/Sonnet). Target app: **`apps/content`**
(live: creatorstudio99.vercel.app). Four goals, in build order:

| Milestone | Goal | Status |
|---|---|---|
| M14 | Notion-style UI redesign (clean professional SaaS) | [DONE] |
| M15 | Repurpose & differentiate — template system → "Content Recipes" + Campaign Mode | [DONE] |
| M16 | Bilingual UI (TH/EN) via static i18n dictionary | [DONE] |
| M17 | Settings page: Profile · API Keys (BYO, server-side) · Agent/MCP | [DONE] |
| M18 | Rebrand & de-clone + Fable-grade generation quality | [PLANNED] |
| M19 | Expert Studio — full-funnel course business generator (7-stage) | [PLANNED] |

**M14–M17 are built and committed** — `72ef281` (M14), `29779cf` (M15),
`231d592` (M16), `21df84e` (M17). M18–M19 are specified below, not yet started.

---

## 0. Execution discipline (READ FIRST — this is what "same capability" means)

The earlier milestones succeeded because of process, not model size. Follow these
rules exactly:

1. **Read before you write.** Before touching any file, Read it fully. Before using
   any DB helper, grep its signature in `packages/db/src/`. Never guess an API.
2. **Check every Supabase `{ error }`.** The #1 recurring bug class in this repo was
   unchecked errors on writes that silently fail under RLS (see refundCredits,
   saveCaptions, set_caption_style incidents in git history). Every `.insert/.update/
   .upsert/.rpc` gets `if (error) throw error;`.
3. **Verify live, not just typecheck.** After each milestone: `pnpm -r typecheck`,
   then run the dev server (`.claude/launch.json` → `content`, port 3100) and
   screenshot/exercise the changed pages. For DB changes, test against PGlite
   (`packages/db/test/`) with `SET ROLE authenticated` — RLS bugs are invisible as
   admin.
4. **Never stage these files** (user's separate in-progress module):
   `docs/07-work-crm.md`, `packages/db/package.json`,
   `packages/db/migrations/0005_workspaces.sql`, `0006_work.sql`,
   `packages/db/test/work-rls.test.ts`, `workspace-rls.test.ts`.
   Check `git status --short` before every commit.
5. **Never commit secrets.** `.env` stays out. New env vars go in `.env.example`
   with a comment.
6. **Do not push without being asked.** Commit locally; ask before push.
7. **Payments stay informational.** No real charging flows.
8. **Doc 02 (prompt engine) is source of truth** for anything touching
   `packages/prompts`. Preserve the zod schema → `toGeminiSchema` pipeline and the
   `partialTopLevel` patch semantics.

---

## M14 — Notion-style UI redesign [DONE]

### Design direction

Current look: dark-first "creator neon" (purple gradients, glow chips). Target:
**Notion-like** — light-first, ink-on-paper, quiet borders, generous whitespace,
small round icons, hover-reveal actions. Keep the existing dark theme as the
secondary mode (tokens already support `data-theme`).

### New design tokens — replace `:root` in `apps/content/app/globals.css`

```css
:root {
  /* Notion-ish light (DEFAULT) */
  --bg: #ffffff;
  --bg-raised: #ffffff;
  --bg-inset: #f7f7f5;        /* Notion's warm gray */
  --bg-hover: #f1f1ef;
  --border: #e9e9e7;
  --text: #37352f;            /* Notion ink */
  --text-dim: #787774;
  --accent: #2383e2;          /* Notion blue — replaces purple as primary */
  --accent-soft: #e7f3f8;
  --success: #0f7b6c; --warn: #cb912f; --danger: #eb5757;
  --radius: 6px; --radius-lg: 10px;   /* tighter than current 12/16 */
  --shadow-card: rgba(15,15,15,.04) 0 0 0 1px, rgba(15,15,15,.03) 0 2px 4px;
}
:root[data-theme="dark"] {
  --bg: #191919; --bg-raised: #202020; --bg-inset: #252525; --bg-hover: #2a2a2a;
  --border: #373737; --text: #d4d4d4; --text-dim: #9b9b9b;
  --accent: #529cca; --accent-soft: #1f3341;
}
```

Component rules (apply across all pages):
- **Cards**: no heavy borders — `box-shadow: var(--shadow-card)`, radius 10px,
  padding 16–20px. Section titles 14px/600, not 16px.
- **Buttons**: default = ghost (transparent, hover `--bg-hover`); primary = solid
  `--accent`, white text, radius 6px, NO gradients anywhere.
- **Chips** → become Notion-style "select options": small (12.5px), pill,
  `--bg-inset` base; selected = `--accent-soft` bg + `--accent` text (not solid fill).
- **Sidebar**: 240px, bg `--bg-inset`, items 13.5px with 20px icon slot, hover
  `--bg-hover`, active = same + 600 weight. Group labels 11px uppercase `--text-dim`.
- **Typography**: keep IBM Plex Sans Thai; base 14.5px; h1 = 28px/700 with a
  leading emoji like a Notion page icon.
- **Empty states**: centered icon + one dim line + one primary action (pattern
  already used in studio gallery — reuse).
- **Theme default flips to LIGHT** — update `HeaderActions.tsx` initial state and
  the `cs-theme` fallback.

### Files to touch (content app only)
`globals.css` (tokens + components), `layout.tsx` (sidebar restyle),
`HeaderActions.tsx` (light default), then a pass over every page in
`apps/content/app/*/page.tsx` to remove inline gradient/glow styles and adopt the
tokens. **No logic changes in M14 — style only.** Screenshot each page before/after.

### Acceptance
- Every page renders in light + dark with the new tokens; no purple gradients left.
- No horizontal scroll at 1280px and 375px widths.
- `pnpm --filter @cs/content typecheck` clean; visual pass on all 13 pages.

---

## M15 — Repurpose & differentiate ("not copy & paste") [DONE]

Two moves: restructure the template UX (the borrowed-looking part), and add one
signature feature Hero AI doesn't have.

### 15a. Templates → "Content Recipes" (grouped by GOAL, with missing types added)

Today: 7 flat chips under "หรือเริ่มจากเทมเพลตที่ตรงกับธุรกิจคุณ:" — same list as the
reference product, and it's missing the most-requested type: a direct **sales post**.
Replace the flat row with goal-grouped recipes:

| Goal group (TH/EN) | Recipes |
|---|---|
| 🛒 ขาย / Sell | **sales_post (NEW)**, promotion, new_product, **flash_sale (NEW)** |
| 🤝 สร้างความเชื่อใจ / Build trust | honest_review, before_after, portfolio, **customer_story (NEW)** |
| 📚 ให้ความรู้ / Educate | five_tips, **myth_bust (NEW)**, **how_to (NEW)** |
| 🎭 สร้างตัวตน / Personality | day_in_life, **behind_scenes (NEW)**, **q_and_a (NEW)** |

New chips go in `packages/prompts/src/content-kit.ts` `TEMPLATE_CHIPS` — each needs
`name_th` + a `structure` string written in the same imperative Thai style as the
existing seven (read them first; match voice). Drafts:

```ts
sales_post: {
  name_th: "โพสต์ขายตรงๆ",
  structure: "hook เจ็บจริง → สินค้าแก้ยังไง (1 ย่อหน้า) → ราคา/โปรชัดเจน → ตอบ objection ที่พบบ่อย 1 ข้อ → CTA สั่งซื้อ + ช่องทางทัก",
},
flash_sale: {
  name_th: "Flash Sale ด่วน",
  structure: "เปิดด้วยเวลาจำกัด (นับถอยหลัง) → ของมีจำนวนจำกัดเท่าไร → ราคาเดิม/ราคาใหม่ → เงื่อนไขสั้น → CTA ตอนนี้",
},
customer_story: {
  name_th: "เรื่องจริงจากลูกค้า",
  structure: "quote ลูกค้า 1 ประโยคเปิด → ปัญหาก่อนใช้ → จุดเปลี่ยน → ผลลัพธ์วัดได้ → ชวนคนที่เจอปัญหาเดียวกันทัก",
},
myth_bust: {
  name_th: "ความเชื่อผิดๆ",
  structure: "ยกความเชื่อผิดที่คนในวงการพูดบ่อย → ทำไมผิด (เหตุผล/ตัวเลข) → ความจริงคืออะไร → สิ่งที่ควรทำแทน",
},
how_to: {
  name_th: "สอนทำทีละขั้น",
  structure: "ผลลัพธ์ที่จะได้ (ก่อน) → ของที่ต้องมี → ขั้นตอน 3-5 ขั้นเป็นข้อ → จุดพลาดบ่อย 1 ข้อ → CTA เซฟโพสต์",
},
behind_scenes: {
  name_th: "เบื้องหลังงาน",
  structure: "โชว์ขั้นตอนที่ลูกค้าไม่เคยเห็น → detail ที่ใส่ใจเป็นพิเศษ → ทำไมถึงทำแบบนี้ → เชื่อมกลับคุณภาพงาน",
},
q_and_a: {
  name_th: "ตอบคำถามที่ถูกถามบ่อย",
  structure: "คำถามจริงจากลูกค้า 1 ข้อเป็น hook → ตอบตรงๆ ละเอียด → ตัวอย่างประกอบ → ชวนถามต่อในคอมเมนต์",
},
```

`TemplateChip` is `keyof typeof TEMPLATE_CHIPS`, so types propagate automatically.
UI: in `apps/content/app/studio/page.tsx`, render 4 goal groups each with a small
group label + its chips. Section heading becomes:
"เลือกสูตรคอนเทนต์ตามเป้าหมาย / Pick a recipe by goal".
Verify each new chip live: generate one kit per new template and eyeball that the
output actually follows the structure (this is a prompt change — live-eval it, don't
trust typecheck).

### 15b. Signature feature — **Campaign Mode (แคมเปญ 7 วัน)** — the dramatic twist

Hero AI generates one post at a time. Our twist: one click turns a topic into a
**7-day content calendar** — 7 linked kits with day-by-day goals (Day 1 awareness
hook → Day 3 educate → Day 5 social proof → Day 7 sales close), consistent brand
voice, no repeated hooks.

Implementation sketch (follows the existing prompt-module pattern in doc 02):
1. New module `packages/prompts/src/campaign.ts`: input = topic/niche/brand;
   output schema = `z.object({ days: z.array(DayPlanSchema).length(7) })` where
   DayPlan = `{ day, goal_th, template: TemplateChipEnum, topic_line, hook }`.
   Register in the prompts barrel; runs on `gemini-2.5-pro` (planning quality).
2. API route `apps/content/app/api/campaign/route.ts` — mirrors `generate/route.ts`:
   auth check → debit credits (charge = 5 credits, one plan not 7 full kits) →
   run module → save to a new `campaigns` table (migration `0007_campaigns.sql`:
   id, user_id, topic, days jsonb, created_at, RLS owner-only — copy the RLS
   pattern from `0001_init.sql` generations table).
3. UI: "🗓 สร้างแคมเปญ 7 วัน" button next to the main generate button in studio
   page; results render as a week grid; each day card has "สร้างโพสต์เต็ม →" which
   deep-links into the normal studio flow with `?topic=<topic_line>&template=<t>`
   (the studio page already reads `params.get("topic")` — reuse).
4. Calendar page (`/calendar`) lists saved campaigns.

Acceptance: one live campaign generated end-to-end, 7 distinct hooks (no dupes),
credits debited once, RLS test proves another user can't read it.

---

## M16 — Bilingual UI (TH/EN) [DONE]

**Decision: static dictionary, NOT live MiniMax translation.** Live MT on every
render is slow, costs per pageview, and produces inconsistent terminology. Use
MiniMax/Gemini ONCE (at authoring time) to draft the EN strings, human-skim, then
ship them as a static dictionary. (Note: MiniMax subscription key currently wired
is TTS `t2a_v2`; text chat is a different endpoint — another reason not to put it
in the render path.)

Mechanism (small, no library):
1. `apps/content/lib/i18n.ts`:
   ```ts
   export const STRINGS = {
     "studio.title": { th: "Content Studio", en: "Content Studio" },
     "studio.recipes": { th: "เลือกสูตรคอนเทนต์ตามเป้าหมาย", en: "Pick a recipe by goal" },
     // ...every UI string, keyed by page.slug
   } as const;
   ```
2. `LangProvider` (client context) + `useT()` hook: `t("studio.recipes")` returns
   by current lang; lang persisted in `localStorage("cs-lang")`, default `th`.
3. Toggle in `HeaderActions.tsx`: a `TH | EN` pill next to the theme toggle.
4. Migrate pages one at a time (studio → dashboard → nav → the rest); grep each
   page for Thai literals to find stragglers: `grep -n "[ก-๙]" page.tsx`.
5. Generated CONTENT stays Thai (that's the product); only UI chrome translates.
   `TEMPLATE_CHIPS.name_th` stays; add a parallel `name_en` field and pick by lang.

Acceptance: toggle flips every visible string on migrated pages with no layout
break (EN strings are often longer — check chip wrapping); refresh preserves choice.

---

## M17 — Settings page (content app): Profile · API Keys · Agent/MCP [DONE]

The studio app already has all three patterns — **port, don't reinvent**:
- Tabs shell: copy `apps/studio/app/settings/SettingsTabs.tsx` structure.
- MCP server: copy `apps/studio/app/api/mcp/route.ts` + `mcp-tokens/route.ts` +
  `tools.ts` wiring (token auth via `@cs/db` `createMcpToken/verifyMcpToken` —
  already Web-Crypto safe). Content-app MCP tools to expose:
  `generate_content_kit`, `generate_image`, `list_brands`, `get_credit_balance`,
  `create_campaign` (after M15b). Each tool handler calls the same functions the
  API routes use — thin wrappers, no new logic.
- Profile tab: display_name save + reset password (same as studio).

**API Keys tab — this one is NEW work (server-side BYO keys):**
1. Migration `0008_user_api_keys.sql`:
   ```sql
   create table user_api_keys (
     user_id uuid primary key references auth.users on delete cascade,
     pexels_key text, pixabay_key text, gemini_key text,
     updated_at timestamptz not null default now()
   );
   alter table user_api_keys enable row level security;
   create policy "own keys" on user_api_keys for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
   Run in PGlite test first (`packages/db/test/`), prove with `SET ROLE
   authenticated` that user B cannot read user A's row, THEN hand the SQL to the
   user to run in Supabase (that's the established flow — the executor does not
   have prod SQL access).
2. `packages/db/src/api-keys.ts`: `getUserApiKeys(db)` / `saveUserApiKeys(db, keys)`
   with error checks; export from barrel.
3. UI: masked inputs (`show last 4 only` after save), save via authed API route —
   NEVER expose keys client-side after save, never log them.
4. Wire-through: `generate-image` route and the worker's stock B-roll path prefer
   the user's key when present, fall back to env. Also update the studio settings
   API Keys tab (currently device-local localStorage) to use the same table.
5. Sidebar: add Settings link to `apps/content/app/layout.tsx` NAV.

Acceptance: keys round-trip (save → reload → masked), RLS cross-user test passes,
an MCP token created in content app can call `generate_content_kit` end-to-end
(curl with `Authorization: Bearer`), studio + content read the same keys table.

---

## M18 — Rebrand & de-clone + Fable-grade generation quality [PLANNED]

### Why (evidence, be honest about it)

Side-by-side against the reference product (app.heroaiengine.com, login-gated;
evidence = its studio screenshot + this doc's own M15 admissions), what still
reads as copy-paste:

1. **The name.** Their browser-tab title is literally "Hero AI Content Engine".
   Our sidebar says "Creator Studio / **Content Engine**". Loudest signal on the page.
2. **Studio page flow, 1:1** — topic textarea → AI idea assist → template chips →
   niche → platforms → generate. (The brainstorm button added 2026-07-12 *increased*
   resemblance: same feature, same layout position.)
3. **Verbatim microcopy** — `studio.brainstorm_hint` ("พิมพ์หัวข้อหรือ niche สักหน่อย
   เพื่อให้ AI ต่อยอดให้") was lifted from their screenshot. Dashboard skeleton too:
   "สวัสดี 👋 / พร้อมสร้าง content วันนี้แล้วหรือยัง?", the 3 pills (brand/model/streak),
   getting-started checklist.
4. **Output page structure** — Hook / Script / Visual / Hashtags with copy·regen·ปรับ
   (doc 01 §5 transcribed it).
5. **Identity** — swapped their navy for Notion blue, but still "blue AI content
   tool", no logo/wordmark.

Already differentiated (defend, don't regress): goal-grouped Recipes + 14 templates
+ per-recipe topic hints, Campaign Mode, bilingual UI, BYO keys + MCP, Notion-light
theme, Work/CRM module, video/caption pipeline.

**Goal:** a first-time visitor who has seen Hero AI should NOT think "clone" —
different name-feel, different look, different screen flow, and output quality that
is visibly a tier above. Zero feature regressions.

Build order inside M18: **18a → 18b → 18c → 18d → 18e**, one commit each, pause
for user review between each (18e can start in parallel after 18a since it touches
`packages/prompts`, not UI).

---

### 18a. Naming & voice sweep (1 day) — cheapest, highest impact

1. **Kill "Content Engine."** Decide the replacement subtitle with the user first
   (options to offer: "คู่หูคอนเทนต์", "Content Copilot", "ครีเอทีฟสตูดิโอ", or no
   subtitle — just ⚡ Creator Studio). Grep sweep: `grep -rn "Content Engine"
   apps/content packages/ui` → `layout.tsx` metadata title, sidebar brand block,
   `i18n.ts` `brand.tagline`, login page, README screenshots later.
2. **Define the product voice** (1 paragraph, committed at the top of
   `apps/content/lib/i18n.ts` as a comment so every future string follows it):
   we are a **โค้ชคู่คิด** (a coach who's done it before), not a neutral tool.
   Concretely: sentences address the user as เพื่อนร่วมงาน ("ลองเล่าให้ฟังหน่อยว่า
   วันนี้อยากขายอะไร"), never robotic imperative ("พิมพ์หัวข้อ"). Every CTA says what
   the user GETS, not what the button does ("ได้ครบ hook·แคปชัน·รูป·แฮชแท็ก ในคลิกเดียว"
   not "เริ่มสร้าง Content").
3. **Rewrite every mirrored string.** The i18n dictionary makes this a single-file
   sweep. Priority list (verbatim or near-verbatim today):
   - `studio.brainstorm_hint` (lifted verbatim — must go first)
   - `dashboard.greeting` + `dashboard.subtitle` ("สวัสดี 👋 / พร้อมสร้าง...")
   - the 3 dashboard pills → replace with genuinely different chips (see 18c)
   - `studio.generate_btn` ("🚀 เริ่มสร้าง Content" → benefit-phrased)
   - getting-started checklist card copy
   - login page tagline
4. **Rename core nouns** where ours are theirs: the output is no longer a generic
   "ชุดคอนเทนต์" — brand it (e.g. **"เพลย์บุ๊ก" / Playbook** or **"ครีเอทีฟคิท"**;
   decide with user). Recipes (done in M15) stays.
5. TH first, then EN column of every changed key. Grep for stragglers:
   `grep -n "[ก-๙]" apps/content/app/**/*.tsx` (hard-coded Thai outside i18n).

**Accept:** `grep -ri "content engine" apps/content` returns 0; the lifted
brainstorm-hint string is gone from both langs; user reads the new dashboard +
studio copy and confirms the voice; no layout breaks in TH or EN.

### 18b. Visual identity (1–1.5 days)

1. **Leave blue entirely.** Both Hero AI (navy `#1e2a8a`-ish) and current us
   (Notion blue `#2383e2`) are blue. Propose 2–3 palettes to the user as small
   HTML swatch mocks BEFORE touching code, e.g.:
   - **อุ่นไทยโมเดิร์น**: burnt orange `#e8590c` accent / cream `#faf6f0` inset / ink
   - **เขียวเติบโต**: deep green `#0f7b5f` accent / warm gray inset
   - **ม่วงครีเอทีฟระดับพรีเมียม**: aubergine `#7048e8` (risk: closer to old neon theme)
2. Apply as token swap in `apps/content/app/globals.css` (`--accent`, `--accent-2`,
   `--accent-soft`, `--bg-inset` warm-shift) + dark-theme equivalents. M14's rule
   stands: no gradients, solid fills.
3. **Wordmark**: replace the ⚡ emoji + plain text with a small inline SVG wordmark
   (text + drawn mark, no external font). Store at
   `packages/ui/src/logo.tsx`, reuse in all 3 apps' sidebars + login pages.
4. **Component geometry shift** so screenshots don't rhyme with either Hero AI or
   Notion: pill chips → **squircle tags with a left icon slot** (radius 8, subtle
   border); primary buttons get a 1px darker bottom-edge (tactile, not flat);
   section cards get an accent left-rail on hover.
5. **Empty states**: replace text-only empties with 4–5 tiny inline SVG
   illustrations (one shared style: 2-color line art using `--accent`), stored in
   `packages/ui`.
6. Dark theme parity pass + 375px mobile pass on all 13 pages.

**Accept:** side-by-side screenshot test (their studio screenshot vs ours, both
themes) shown to the user — different at a glance; Lighthouse ≥ current; no
contrast regressions (AA on text).

### 18c. Re-architect the two most-seen screens (2 days)

**Studio → goal-first, two-step flow** (kills the 1:1 layout map):
1. Step 1 card: **"วันนี้อยากได้อะไร?"** — the 4 goal groups rendered as large
   selectable cards (🛒 ขาย / 🤝 เชื่อใจ / 📚 ให้ความรู้ / 🎭 ตัวตน), each showing its
   recipes as secondary chips inside the card. Picking a recipe reveals step 2.
   (Topic-first still possible: a "มีหัวข้อแล้ว ข้ามไปพิมพ์เลย →" link collapses to
   the classic form; deep-links `?topic=`/`?template=`/`?jobId=` keep working.)
2. Step 2: topic (with the M15 per-recipe hint), niche, platforms, brand/style —
   unchanged logic, new arrangement (2-column on desktop: inputs left, live
   "สิ่งที่จะได้" summary right).
3. **Platform-preview results** — the signature visual: render each script inside
   a mock platform frame (FB post card / IG caption sheet / TikTok caption bar),
   CSS-only components in `packages/ui` (`PostPreviewFB`, `PostPreviewIG`,
   `PostPreviewTikTok`). Copy buttons stay. Hook/Visual/Hashtags sections remain
   but restyled per 18b. Hero AI shows plain text boxes — this is the "obviously
   not a clone" screen.
4. **Dashboard** → center on *this week*: (a) campaign progress card (from
   `campaigns` — days done vs planned, next day's post one click away),
   (b) content-calendar peek (next 7 days from `scheduled_date`), (c) recent work
   strip (last 4 generations w/ thumbnails → `?jobId=` reopen), (d) quota/credit
   meter (fixes the invisible-quota UX gap found 2026-07-12 — show
   `remaining`/limit from the daily counter + credit balance). Getting-started
   checklist survives only for brand-new accounts (0 generations), then never again.

**Accept:** new-user flow (goal → recipe → topic → generate) and old-user flow
(direct topic) both live-verified; all deep-links still work; campaign + calendar
cards show real data; quota meter matches `try_consume_daily_use` state; mobile pass.

### 18d. Positioning — lead with what they can't copy (0.5 day)

1. Dashboard hero rotation (one card, not three): Campaign Mode ("โพสต์เดียวใครๆ
   ก็เจนได้ — เราวางให้ทั้งสัปดาห์"), Agent/MCP ("สั่งงานผ่าน Claude ได้"), Work+CRM
   (when entitled).
2. Pricing page: reorder feature bullets so Campaign Mode + MCP + (coming) CRM
   top the Pro column — the differentiator sells the plan, not "more generations".
3. Login page gets one line of positioning under the wordmark (the new voice's
   one-sentence pitch) instead of bare "เข้าสู่ระบบ".

**Accept:** user sign-off on copy; screenshots archived in `scratchpad/rebrand/`
for the before/after record.

---

### 18e. Fable-grade generation quality (2–3 days, parallel-safe after 18a)

**Objective:** output that reads/looks like a top-tier model (Claude Fable-class)
wrote it — for Thai copywriting, image prompts, and video prompts — while still
running on the existing Gemini router (fast=2.5-flash, smart=2.5-pro). The lever
is the prompt system + pipeline, not the model id. Doc 02 is source of truth for
prompt text: every change below lands as a **doc 02 addendum first**, then code.
All upgraded modules bump `prompt_id` (`content.kit.v1` → `v2` etc.) — `prompt_id`
is already persisted per generation, so v1-vs-v2 output comparison over `/history`
is free A/B evidence.

**Why output feels "mid" today (diagnosis):** single-pass generation on the fast
tier; principles are stated but nothing *enforces* them (no rubric, no exemplars,
no revision); brand context is thin (10 fields) with no examples of *great* output;
image prompts follow one formula → same-y composition; video shots don't cite the
script (visuals drift from copy).

#### 18e-1. Content writing (`content.kit.v2`, `campaign.v2`, `viral.v2`)

1. **Gold exemplars (few-shot).** New file `packages/prompts/src/exemplars.ts`:
   2 hand-curated, full example outputs **per goal group** (8 total, TH), each
   annotated with 1 line on WHY it works ("hook ระบุตัวเลขเจ็บจริง ไม่ใช่คำถามจืด").
   Injected into the system prompt for the matching recipe's goal group only
   (token budget: ~2 exemplars ≈ 1.2k tokens, acceptable on both tiers). Authoring
   these 8 exemplars is part of this milestone — write with the strongest available
   model, hand-edit, live-eval each against a Thai reader (the user).
2. **Hook rubric + banned clichés.** Extend `HOOK_PRINCIPLES`: a hook must pass
   4 checks — (จำเพาะ: names a number/object/situation, not abstraction), (ช่องว่าง
   ความอยากรู้: opens a loop the caption closes), (เจ็บจริง: pain the audience said
   out loud, not marketer-imagined), (พูดได้เต็มปาก: no unverifiable claims).
   Banned Thai clickbait list: "คุณกำลัง...อยู่หรือเปล่า?" cold-opens, "เปิดโลก",
   "เคล็ดลับที่ไม่มีใครบอก", "ปังมาก", "ห้ามพลาด!!" and exclamation stacking, generic
   "ใครๆ ก็ทำได้". The model must self-check each hook against the rubric BEFORE
   emitting (instructed as an internal checklist, output unchanged).
3. **Concrete-detail floor.** New rule in `OUTPUT_HYGIENE_RULES`: every caption
   must contain ≥2 of {ตัวเลขจริงจาก input, สถานการณ์มีฉาก ("ตอนลูกค้าทักมาตีสอง..."),
   sensory detail, named objection + answer}. Fabrication rules unchanged — details
   come from the user's input or are framed as scenario, never invented stats.
4. **Critique-and-revise pass (the big one).** New module `content.critic.v1`
   (smart tier, temp 0.3): input = draft kit JSON + the same brand/rubric context;
   output = `ContentKitPatchSchema` (reuses refine's patch machinery + 
   `applyContentKitPatch`) fixing ONLY what fails the rubric, plus a
   `critique_notes: string[]` field persisted into `generations.output.meta` for
   transparency. Pipeline in `/api/generate`: draft (fast) → critique-revise
   (smart) → save. Latency roughly +8–15s, cost ≈ +1 smart call.
   **Gating:** default ON for Pro/Business; Free gets a per-day taste (e.g. first
   3 kits/day polished) + a "✨ ขัดเงาโดย AI ระดับโปร" badge on polished results —
   the quality gap becomes the upsell. No schema change: pipeline is server-side.
5. **Brand voice deepening.** `brands` gains optional `best_posts text[]` (max 3,
   user-pasted own winners; migration `0017_brand_best_posts.sql` + RLS untouched
   — column on an owner-scoped table + PGlite gate test per repo rule).
   `brandBlock()` appends them as "ตัวอย่างโพสต์ที่แบรนด์นี้เคยเขียนแล้วเวิร์ก" few-shot.
   Brands page gets a 3-slot paste UI.
6. **Optional BYO-Claude tier (stretch, behind a flag).** M17 built server-side BYO
   keys; add `anthropic_key` to `user_api_keys`, a `claude` entry in the router
   MODEL_MAP (claude-sonnet-5 via the user's key), and a settings toggle "ใช้
   Claude เป็นเครื่องยนต์เขียน (คีย์ของคุณ)". Zod schemas already validate output
   shape; the router's JSON-repair path must be verified against Anthropic's
   response format. Ship only if 18e-1..5 alone don't satisfy the user's bar.

#### 18e-2. Image prompt generation (upgrade `IMAGE_PROMPT_FORMULA` → v2)

1. **Art-direction vocabulary layer**: formula gains [lens/focal length]
   ("85mm portrait", "24mm wide"), [color grade] ("warm teal-orange grade",
   "muted film look"), [reference-safe style words] (editorial, documentary,
   studio commercial) — with a lookup table per niche so a café brand and a
   finance brand stop getting the same "glossy 3D render" look.
2. **Per-niche visual identity presets** in `packages/prompts/src/visual-presets.ts`:
   12 presets keyed to the NICHES list (อาหาร → "natural light food editorial,
   45° overhead, ceramic + wood props"; การเงิน → "clean editorial office, deep
   depth, confident posture"...). Selected niche injects its preset; brand colors
   (if brand set) woven as "brand accent color subtly present in props/background".
3. **Composition variety enforcement**: the 3 illustrations must each declare a
   DIFFERENT [shot type] (wide establishing / medium action / macro detail) and the
   cover must differ from all three — stated as a hard rule with the enum inline.
4. **Thai-context authenticity rules**: default Thai subjects stays; add
   environment authenticity ("Bangkok shophouse", "ตลาดสด", "BTS-adjacent condo")
   with a rule to pick environments matching the niche, never generic western
   stock-photo offices unless the niche demands it.
5. Safe-zone + no-text guards unchanged (they're battle-tested).

#### 18e-3. Video prompt generation (upgrade `VIDEO_PROMPT_FORMULA` → v2)

1. **Beat-mapping**: each of the 8 shots must cite which script line it visualizes
   (`matches_line: string` added to the video_prompts schema item) — kills
   visual/copy drift, and the UI can later show shot↔line pairing.
2. **Continuity contract**: one protagonist described ONCE in shot 1 (age/clothing
   /setting), later shots reference "the same woman" — no wardrobe teleporting;
   one location change max per 8 shots.
3. **Duration budget**: per-shot `duration_s` must sum to 30–60s with hook ≤3s —
   stated as arithmetic the model must verify before emitting.
4. **Motion grammar expansion**: extend the verb list (speed ramp, rack focus,
   snap zoom, whip-pan transition, match cut on action, POV reveal) + a pacing rule:
   shots 1–2 fast (≤3s), middle beats 4–6s, closing shot longest.
5. **Aspect awareness**: 9:16 framing note on every shot (subject in center-safe
   vertical band) since TikTok/Reels is the target.

#### 18e-4. Eval harness & rollout (how we know it's actually better)

1. `scratchpad/eval/` (later promoted to `packages/prompts/eval/` if kept):
   `golden-topics.json` — 12 fixed topics (3 per goal group, real SME scenarios).
   `run-eval.ts` — generates v1 and v2 kits for all 12, saves side-by-side MD.
2. **LLM-judge pass**: `eval.judge.v1` module (smart tier): scores each kit 1–5 on
   {hook stop-power, Thai naturalness, concreteness, brand fit, cliché count
   (inverted)} with 1-line reasons. v2 must beat v1 on ≥4 of 5 dimensions on ≥9/12
   topics before shipping. Judge is advisory — final call is the user reading 3
   side-by-sides.
3. **Human eval**: present the user 3 blind A/B pairs (v1 vs v2, unlabeled) in chat;
   user picks winners. Ship only on 3/3 or 2/3+judge-pass.
4. Rollout: `prompt_id` v2 behind an env flag `PROMPTS_V2=1` for one deploy →
   flip default after 48h of live use → keep v1 modules in-tree for 1 milestone
   then delete. Regression check: image/video prompt changes re-run through the
   3× repeat script against the live image model (M8's diagnosis pattern) to
   confirm no schema drift or refusal spikes.

**Accept (18e overall):** eval passes per 18e-4; one full live kit + campaign +
image generated on v2 with the user approving quality; `critique_notes` visible in
a polished generation's history entry; typecheck + existing PGlite gates green;
doc 02 addendum committed in the same PR as the prompt code.

---

### 18f. Kill Viral Studio + replacement tools (0.5–1 day)

**Decided (user, 2026-07-13): Viral Studio dies.** Trend-chasing is the most
commodity feature in every AI content tool, its data goes stale, and it's the
least defensible surface in the app.

Removal checklist: `apps/content/app/viral-studio/` (2 pages),
`app/api/viral-kit/route.ts`, nav entry in `SidebarNav.tsx`, dashboard chip,
`viral.*` i18n keys, viral template defs in `packages/prompts/src/templates.ts` +
`packages/db/src/templates.ts`. Old `viral_kit` rows in `generations` must keep
rendering harmlessly in `/history` (label them "เทรนด์ (เก่า)", no reopen link).

**Replacements (DECIDED by user 2026-07-13): build #1 Post X-Ray + #2 Thai
occasion planner; #3 stays backlog.**
1. **Post X-Ray (แกะสูตรโพสต์)** ⭐ hero — one tool, two modes:
   (a) โพสต์ของฉัน = Post Doctor: paste an underperforming post → rubric-based
   diagnosis (reuses 18e critic machinery) + rewrite in the user's brand voice;
   (b) โพสต์คู่แข่ง = Competitor Remix: paste competitor ad text OR upload a
   screenshot (Gemini vision — needs a new image-input path in `packages/ai`,
   the router is text-only today) → breakdown (hook mechanism, offer, CTA
   psychology, weakness) → counter-post that is forced to use a DIFFERENT hook
   mechanism and structure ("ห้ามใช้โครงเดียวกัน — หาจุดที่เขาพลาดแล้วตีตรงนั้น") —
   transformation, not imitation, for both IP hygiene and positioning. Links:
   fetching FB/IG/TikTok URLs is login-walled and ToS-fragile — ship paste +
   screenshot only. Competitor analyses stay private (never surface in
   Inspiration).
2. **ปฏิทินไทย (Thai occasion planner)** — content angles from the Thai marketing
   calendar (สงกรานต์, วันแม่, 9.9/11.11, เงินเดือนออก, พืชมงคล per niche); static
   data, never stale, deeply local; slots into Viral Studio's vacated nav position.
3. Fast-follows (backlog): ตอบคอมเมนต์/แชท reply assistant; repurposer (winning
   post → platform splits + 5 fresh angles); ad copy studio with Thai-compliance
   guard; รีวิวลูกค้า → customer_story pipeline.

**Accept:** viral routes/pages/nav gone; `/history` renders legacy viral rows
without errors; chosen replacement(s) live-verified end to end.

---

## M19 — Expert Studio: full-funnel course business generator [PLANNED]

### What & why

One-click-per-stage generator that takes a Thai expert from "ฉันถนัดเรื่อง X" to a
complete course business: personal-brand positioning → marketing funnel → 
masterclass architecture (core modules) → per-module scripts → 7-EP mini course →
90-min live sales script. This is a category jump Hero AI cannot follow: they
generate *posts*; we generate the *business that the posts sell*. It also
completes the value story with Work+CRM (run the launch as tasks, track course
buyers as deals).

**Source material:** the user's own "Expert Make Money" framework pack at
`/Users/psk/Documents/Claude-Cowork-Training/Template _ Expert Make Money/`
(SKILL.md = 7-stage pipeline, QUICK-REFERENCE.md = per-stage templates,
PROMPT.md = per-stage prompt drafts, expert-secret-make-million.md = full source).
The 7 stages: **DISCOVER → DEFINE → MARKET → DESIGN → WRITE → LAUNCH → SELL**,
iron rule: output of stage N = input of stage N+1, no skipping.

**IP/rebrand rule (important):** the source is third-party course material the
user owns a copy of. We adopt the *pipeline logic* but ship OUR OWN framework
names and copy. Never ship the source PDFs' verbatim sentences (e.g. the
objection-script one-liners) — the AI generates fresh copy per user from the
*structure*. This doubles as differentiation.

**Framework names (DECIDED by user 2026-07-13 — "Creator DNA" theme):**
- Quiz: **"DNA ผู้เชี่ยวชาญ"** (Expert DNA test)
- 4 types (replacing L.A.R.H.): **สายโค้ช** (Coach ← Leader), **สายลุย**
  (Doer ← Adventurer), **สายสรุป** (Digest ← Reporter), **สายลุกใหม่**
  (Comeback ← Hero)
- Module-script formula (replacing CLASS): **"สูตร เปิด-สอน-ทำ-หนุน-ชวนแชร์"**
  (plain Thai, no acronym: เปิด=Context, สอน=Lesson, ทำ=Action, หนุน=Support,
  ชวนแชร์=Share)
- Sales-script formula (replacing HSFO/Sales Script Killer): **"สคริปต์ปิดรอบ"**
- Offer framework (core follows Alex Hormozi's *$100M Offers* method — user
  directive 2026-07-13; renamed, fresh copy, never his text verbatim):
  **"สูตรข้อเสนอที่ปฏิเสธไม่ลง"** with **"สมการคุณค่า"** (the value equation:
  ↑ฝันที่อยากได้ × ↑ความมั่นใจว่าจะได้จริง ÷ ↓เวลาที่ต้องรอ × ↓ความยาก-สิ่งที่ต้องแลก)
- Lead framework (core follows Hormozi's *$100M Leads* — user directive
  2026-07-13; same rename rule): **"สี่ทางหาลูกค้า"** (the core four, renamed:
  ทักคนรู้จัก = warm outreach, โพสต์ให้โลกเห็น = free content, ทักคนแปลกหน้า =
  cold outreach, ยิงแอด = paid ads) + **"ตัวคูณ 4 ตัว"** (lead getters: ลูกค้าเก่า
  บอกต่อ, ทีม, เอเจนซี่, พาร์ทเนอร์-ตัวแทน) + **"กฎ 100 ต่อวัน"** (the daily
  volume commitment) + **"ทัก-ชม-ถาม"** (the warm-outreach opener structure)

**Project categories (user request 2026-07-13): two generators, one pipeline.**
At project creation the user picks what to build:

| Category | Path through the pipeline | Cost | For |
|---|---|---|---|
| 🏔 **Masterclass (คอร์สเต็ม)** | full 7 stages | ~31cr | the real product |
| 🚀 **Mini Course (คอร์สทดลอง 7 ตอน)** | 4 steps: DISCOVER → DEFINE → MINI DESIGN → QUICK SELL | ~5cr | test the market in a weekend before building the full course |

- `expert_projects.project_type` (`'masterclass' | 'mini_course'`) selects which
  stage sequence the stepper renders — same modules, different route.
- **MINI DESIGN** reuses `expert.launch.v1` (names ×3 + hook + 7-EP planner by
  type + production checklist), 2cr — it IS the mini-course designer, just
  reached directly instead of as stage 6.
- **QUICK SELL** = `expert.sell.v1` with `mode: "quick"`: 15-minute sales script
  + **landing-page copy** (headline/bullets/CTA — quick mode only), 3cr.
- **Upgrade path (retention hook):** a completed mini-course project gets
  "ขยายเป็น Masterclass →" — creates a masterclass project pre-seeded with the
  mini's s1/s2 outputs and design inputs. Copy+prefill, no new prompt module.
- Future categories (Workshop 1 วัน, E-book/Lead Magnet) fit the same picker — backlog.

### 19a. Framework data layer (`packages/prompts/src/expert/`) (0.5 day)

Distill the source pack into typed TS data (no AI, no DB):
- `quiz.ts` — the "DNA ผู้เชี่ยวชาญ" quiz. **Author every question fresh — do NOT
  copy the source PDFs' 12 questions** (IP rule, and theirs are blunt "what are
  you like" self-descriptions; scenario questions type people more honestly).
  Spec (user directive 2026-07-13: precise, nobody has time for 50 questions):
  - **Part A — type detection, 6 questions**: scenario-based ("ลูกค้าทักมาถาม
    เรื่องที่คุณถนัด สิ่งแรกที่คุณทำคือ...", "ถ้าต้องอัดคลิปแรกพรุ่งนี้ คุณจะเปิด
    กล้องแล้วพูดว่า..."), 4 options each mapping to สายโค้ช/สายลุย/สายสรุป/
    สายลุกใหม่; dominant tally = core type, runner-up = supporting type.
  - **Tiebreaker (adaptive, max 1 extra)**: shown ONLY when two types tie — one
    forced-choice between the tied types' strongest tells. Never more than 7
    type questions on screen in total.
  - **Part B — readiness inputs, 4 questions** (chips, no free text): ระดับ
    ประสบการณ์ในเรื่องที่จะสอน · ฐานผู้ติดตามวันนี้ (ยังไม่มี/<1k/1k-10k/>10k) ·
    เวลาที่ให้ได้ต่อสัปดาห์ · เคยขายอะไรมาก่อน (ไม่เคย/สินค้า/บริการ/ของดิจิทัล).
    Each answer pipes into a specific stage prompt: experience → positioning in
    DISCOVER + credibility in SELL; follower base → traffic plan in MARKET;
    time/week → production realism in LAUNCH; selling history → value-ladder
    starting rung in MARKET.
  - **Iron rule for the quiz itself: 10 questions total (11 worst case), and
    every question must feed at least one stage prompt — a question that
    doesn't earn its slot gets cut.** All tap-chips, ≤2 minutes, scoring is
    pure client-side arithmetic — free, no AI call.
- `types.ts` — the 4 expert types (our renamed versions) with: strengths, voice
  keywords, intro templates, 7-EP outline template each (from QUICK-REFERENCE §6),
  HSFO-style example skeletons per type.
- `frameworks.ts` — value-ladder rungs + THB price bands, sell-funnel ratios
  (80/15/5), naming formula (HOW+PowerWord : WHAT+trigger, Thai power words),
  product-package shape (Masterclass + Tools + Bonus×3 + Special), 90-min script
  timeline blocks, 3-belief / objection-handling *structures* (not the verbatim
  lines).
Framework names are already decided (see "Framework names" above) — no further
sign-off needed before this lands.

### 19b. DB layer (0.5 day)

Migration `0018_expert_projects.sql` (number may shift if 18e's 0017 lands first):
```sql
create table expert_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,                -- working title, user-editable
  project_type text not null default 'masterclass',  -- 'masterclass' | 'mini_course'
  expert_type text,                  -- quiz result (สายโค้ช/สายลุย/สายสรุป/สายลุกใหม่)
  quiz_answers jsonb,                -- raw quiz answers (retake-able)
  stage int not null default 1,     -- furthest unlocked stage 1-7
  s1_discover jsonb, s2_define jsonb, s3_market jsonb, s4_design jsonb,
  s5_write jsonb, s6_launch jsonb, s7_sell jsonb,   -- one output blob per stage
  lead_magnet_content jsonb,        -- full lead-magnet asset (expert.leadmagnet.v1)
  s8_content30 jsonb,               -- 30-day launch content plan (expert.content30.v1)
  signature_framework jsonb,        -- course framework + visual spec (expert.framework.v1)
  bonus_contents jsonb,             -- full bonus assets keyed by slot (expert.bonus.v1)
  offer jsonb,                      -- engineered offer (expert.offer.v1) — feeds s7 sell
  leads_plan jsonb,                 -- lead-getting plan (expert.leads.v1)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
Owner-only RLS (same shape as `campaigns` in `0007_campaigns.sql` — copy that
policy + column-privilege lock pattern: revoke update, re-grant safe columns,
never `user_id`). PGlite gate test `packages/db/test/expert-rls.test.ts` (global
rule: every migration gets a gate test) — cross-user isolation + stage-column
smuggling checks. Wrapper `packages/db/src/expert.ts` (CRUD + `saveStageOutput`
with affected-row checks, matching crm.ts conventions).

### 19c. Prompt modules (1.5 days) — one per stage, `expert.*` family

All follow the existing `PromptModule` pattern (zod schema → `toGeminiSchema`),
Thai-first, brand-voice-aware (inject `brandBlock` when the user has a brand),
and each stage's `user()` prompt embeds the SAVED OUTPUT of prior stages (the
iron rule, enforced by code — the route refuses to run stage N if N-1 is empty):

| Module id | Tier | In (besides prior stages) | Out (schema, abridged) |
|---|---|---|---|
| `expert.discover.v1` | fast | quiz result + ความถนัด/ประสบการณ์/ทำไมอยากสอน | brand DNA {why, vibe, origin_story(5 lines), positioning} |
| `expert.define.v1` | fast | — | {intro_templates×3, vibe_reco, voice_keywords} |
| `expert.market.v1` | smart | กลุ่มเป้าหมาย, งบ, platforms ที่มี | {funnel_plan(viral/insight/sell), lead_magnet{name,format,3 บท}, value_ladder×5 (THB), repurpose_map, traffic_phases×3} |
| `expert.design.v1` ⭐ | smart | ผลลัพธ์ที่จะให้ผู้เรียน | {course_dna(WHO/WHAT/HOW), names×3 (สูตร naming), hook(3 บรรทัด), one_thing, milestones×7{title,format,why_before_next}, quick_win, package{masterclass,tools,bonus×3,special}} |
| `expert.write.v1` | smart | milestone ที่เลือก (รันทีละ module) | {framework{name(3-5 ตัวอักษร),steps}, module_script per our CLASS-equivalent {context, lesson, action, support, share}, pain_point, aha_moment} |
| `expert.launch.v1` | fast | — | {mini_course{name×3, goal}, episodes×7{title,goal,cta} ตาม type template, production_checklist, quick_action_3day} |
| `expert.sell.v1` | smart | ราคา, ข้อโต้แย้งที่เจอบ่อย | {big_promise, origin_story_5step, beliefs×3{old,new,evidence_type}, value_stack{items,total,real_price,live_price}, cta×3, objection_scripts×4 (สร้างใหม่จากโครง), funnel_3step, live_timeline(0-15/15-45/45-60/60-75/75-90)} |
| `expert.leadmagnet.v1` | smart | lead-magnet idea ที่เลือกจาก s3 | full asset by format — e-book: {title, intro, chapters×3-5{heading, body เต็ม}, cta_page}; checklist: {items×10-15{item, ทำไม, ทำยังไง}}; template: {sections + fill-in guides} — ทุก format ปิดท้ายด้วยหน้า CTA ดึงเข้า Line OA/waitlist |
| `expert.content30.v1` | smart | วันเปิดขายเป้าหมาย | {days×30{day, layer(viral/insight/sell), format(text/short_video), topic, hook}} — บังคับสัดส่วน 80/15/5 ตาม funnel, hooks ผ่าน 18e rubric, สลับ format ไม่ให้ซ้ำจังหวะ, เรียงเป็น story arc ไต่สู่วันเปิดขาย |
| `expert.framework.v1` | smart | สิ่งที่สอน (จาก s4) + brain-dump สั้นๆ | {name_th, acronym(3-5 ตัวอักษร โดยแต่ละตัวมีความหมายจริง), steps×3-5{letter, word, meaning_th}, tagline, shape(loop/flow/ladder/path — เลือกให้ตรง logic ของสูตร), color_roles, image_prompt_en (โปสเตอร์ stylized สำหรับ Visual Studio)} |
| `expert.bonus.v1` | smart | bonus slot ที่เลือกจาก s4 package + หน้าที่ทางจิตวิทยา (ให้คิด/ให้ลงมือ/ให้มั่นใจ) | full asset by format — case-study writeup / Q&A vault / checklist / mini-guide / script — {title, format, sections{heading, body เต็ม}, delivery_note} |
| `expert.offer.v1` | smart | ราคาที่ตั้งใจขาย (จาก s3 value ladder) | {value_equation{dream_outcome, likelihood_boosters[], time_delay_cuts[], effort_cuts[]}, problems_solutions×N{problem(ก่อน/ระหว่าง/หลังเรียน), solution, delivery_format}, offer_stack{items[]{name, value_thb, เหตุผลที่ใส่}, total_value, price, premium_justification}, guarantee{type(ไม่มีเงื่อนไข/มีเงื่อนไข/ท้าพิสูจน์), copy}, scarcity, urgency, offer_name (สูตรตั้งชื่อ 5 ส่วน: เหตุผล-กลุ่ม-เป้าหมาย-กรอบเวลา-รูปแบบ), one_liner} |
| `expert.leads.v1` | smart | — (อ่านจาก quiz Part B + s3 + offer/lead magnet ถ้ามี) | {channel_ranking (สี่ทาง เรียงตามความพร้อมจริงจาก quiz), daily_100_plan (ปรับตามเวลา/สัปดาห์ที่มีจริง), warm_outreach{opener ตามโครง ทัก-ชม-ถาม, follow_up_cadence}, cold_outreach{script, personalization_checklist, volume_target}, give_ask_ratio (ผูกกับ s8 layers), referral_engine{ask_script, incentive_idea}, affiliate_starter{pitch, commission_idea}, engaged_lead_def + weekly_targets} |

**Lead engine — "สี่ทางหาลูกค้า" (user request 2026-07-13; core = Hormozi $100M
Leads, renamed per IP rule).** `expert.leads.v1` (5cr, unlocked after s3) turns
the funnel into a personal lead-getting operation. What makes it personal
rather than generic advice: the quiz's Part B answers drive it — follower base
picks which of the four roads to lead with (no audience → ทักคนรู้จัก + ทักคน
แปลกหน้า first, not "post more content"; >10k → โพสต์ให้โลกเห็น + ตัวคูณ),
hours/week scale the กฎ-100 daily plan to what's actually doable, and selling
history calibrates script boldness. The lead magnet (idea → full asset,
already in the plan) is positioned per the method: solve the narrow problem
free, sell the implementation. Give:ask cadence hooks into the 30-day plan's
80/15/5 layers so content and outreach tell one story. **CRM bridge:** when the
workspace has `work_crm`, the panel offers "ตั้ง pipeline คนสนใจเรียนใน CRM →" —
engaged leads land as contacts/deals in M11's CRM (the modules finally feed
each other). Scripts are generated fresh in the user's brand voice — never the
book's lines.

**Offer engineering — "สูตรข้อเสนอที่ปฏิเสธไม่ลง" (user request 2026-07-13; core =
Hormozi $100M Offers, renamed per IP rule).** `expert.offer.v1` (5cr, unlocked
after s4) upgrades the raw product package into a value-engineered offer, in
the method's actual order: (1) สมการคุณค่า audit — for the course's dream
outcome, list what raises certainty, what cuts waiting time, what cuts
effort/sacrifice; (2) problem→solution→delivery sweep — enumerate every
obstacle the learner hits ก่อน/ระหว่าง/หลังเรียน, solve each, pick a delivery
vehicle, then trim to high-value/low-cost items; (3) stack + price — itemized
value vs price with premium justification (คิดราคาจากคุณค่า ไม่ใช่ต้นทุน);
(4) risk reversal — guarantee typed to the user's risk appetite; (5) honest
scarcity/urgency (real cohort/seat limits only — no fake countdowns, consistent
with OUTPUT_HYGIENE_RULES' no-fabrication stance); (6) name the offer + the
one-liner ("ข้อเสนอที่ทำให้คนรู้สึกโง่ถ้าปฏิเสธ"). **Feeds forward:** when `offer`
exists, stage 7's SELL prompt embeds it — the value stack in the sales script
comes straight from `offer_stack`, and the guarantee/objection scripts reuse
its risk-reversal copy. The bonus generator's slots also appear as stack items.

**Signature framework generator + visual (user request 2026-07-13).** The source
pack's Stage-5 framework method (brain dump → pattern → 3-5-letter name) plus
its Framework Design Principles (shape semantics: วงกลม=Loop, ลูกศร=Flow,
พีระมิด=Ladder, บันได=Path; role colors) become a generator + renderer pair:
`expert.framework.v1` produces the framework *concept* AND a structured visual
spec; a new `FrameworkDiagram` component in `packages/ui` renders it as **in-app
SVG** with 4 shape layouts — deterministic, crisp Thai text, brand-colorable,
downloadable as SVG/PNG. (AI image models garble diagram text — SVG is the
right tool; the `image_prompt_en` field is the optional extra for a stylized
poster version via Visual Studio, where text quality matters less.) The user
can switch shapes after generation without regenerating. Saved to
`signature_framework`. 3cr.

**Course bonus generator (user request 2026-07-13).** Stage 4's package names
the 3 bonuses + special bonus as *ideas* with psychological jobs (Bonus #1 ให้คิด,
#2 ให้ลงมือ, #3 ให้มั่นใจ, Special = ของแทนใจ); each slot then gets
"สร้างเนื้อหาโบนัสเต็ม →" running `expert.bonus.v1` for the actual asset —
same idea→full-content upgrade as the lead magnet. Saved per-slot into
`bonus_contents`. 3cr per bonus (max 4 slots = 12cr).

**Lead magnet: from idea to full asset (user request 2026-07-13).** Stage 3
generates lead-magnet *ideas* (name + format + outline); the s3 panel then
offers "สร้างเนื้อหา Lead Magnet เต็ม →" which runs `expert.leadmagnet.v1` on the
chosen idea and produces the complete asset (real chapter text, not an outline),
saved to `lead_magnet_content`, exported via a print view. 5cr.

**30-day launch content engine (user request 2026-07-13).** One smart call
(`expert.content30.v1`, 5cr) generates the 30-day PLAN — day-by-day topics +
hooks + funnel layer + format (text post / short video), viral-engineered via
the 18e hook rubric and paced as a story arc toward launch day. Writing each
day's FULL text post or short-video script is on-demand: every day card
deep-links into Content Studio prefilled (topic + hook + template + brand voice)
— the existing content kit already produces TikTok-style spoken scripts + 8-shot
video prompts, so no new write path is needed; full posts consume normal
content_studio quota/credits. Requires s3+s4 (funnel + course promise), so it's
a masterclass-path feature; mini-course projects keep the lighter "วางแคมเปญ
7 วัน" Campaign Mode link instead.

`expert.design.v1` is the flagship the user called out ("masterclass + core
modules designs generator") — it gets the 18e treatment from day one: smart tier,
1 gold exemplar, self-check rubric (milestones must be sequential-dependency
ordered, quick win must be achievable in module 1, names must follow the formula).
Stage 5 runs per-milestone (7 short calls on demand, not one giant call) so users
iterate module-by-module and regenerate single modules cheaply.

**Credits/gating (DECIDED by user 2026-07-13 — credits per stage):** stages 1-2
free (quiz is arithmetic; discover/define are cheap fast-tier calls — the taste).
Stages 3-7 debit credits via the existing `debit_credits` ledger: **5 credits**
each for the smart-tier stages (MARKET, DESIGN, SELL), **2 credits** for LAUNCH,
**2 credits per module script** in WRITE (max 7 modules = 14cr if all generated),
**5 credits** each for the lead-magnet, 30-day-plan, offer-engineering, and
lead-engine add-ons, **3 credits** for the signature framework, **3 credits
per bonus asset** (max 4 = 12cr). Full masterclass project ≈ 31cr; all-in with
every add-on generator ≈ 66cr. No plan gate — works today without billing
infra. Recommended generation order shown in the UI: s4 → **offer → bonuses**
→ s7, and s3 → **lead magnet → lead engine** → 30-day plan (the sell script is
strongest when the offer exists first; the lead engine is strongest when the
lead magnet exists first).
Daily-quota bucket: new `expert_studio` tool key (NOT shared with
content_studio — a course project shouldn't eat post quota).

### 19d. Wizard UI (`apps/content/app/expert/`) (1.5 days)

- **Landing** `/expert`: project list (like boards list) + "เริ่มโปรเจกต์ใหม่" →
  **category picker first** (🏔 Masterclass คอร์สเต็ม / 🚀 Mini Course คอร์สทดลอง —
  see "Project categories" above; card copy sells the difference: "ของจริง ครบ
  7 ขั้น" vs "เทสตลาดได้ในสุดสัปดาห์เดียว").
- **Project page** `/expert/[id]`: stage stepper rendered from `project_type`
  (7 steps for masterclass, 4 for mini course; the pipeline drawn as a climb —
  ties into the mountain/summit metaphor of the source's case study), stages
  locked until prior stage saved; each stage = one panel:
  1. DISCOVER — the 10-question quiz as tap-chips (6 type + 4 readiness +
     adaptive tiebreaker, per 19a spec; client-side scoring, instant type
     reveal with our type card art from 18b's illustration set) → 3 inputs → 
     generate DNA → editable result saved to `s1_discover`.
  2-7. Per-stage form (the few inputs that stage needs) → generate → **editable
  structured output** (every generated field is an editable input before save —
  the user's edits are what feed the next stage, not raw AI output).
- Stage 5 panel lists the 7 milestones from s4 with per-module "เขียนสคริปต์" buttons.
- **Lead Magnet panel** (inside stage 3, after s3 saved): shows the generated
  lead-magnet ideas; picking one + "สร้างเนื้อหาเต็ม →" runs `expert.leadmagnet.v1`;
  result renders as an editable document view saved to `lead_magnet_content`.
- **Framework panel** (unlocked after s4): generate → SVG preview via
  `FrameworkDiagram` (packages/ui) → shape switcher (loop/flow/ladder/path,
  no regenerate needed) → download SVG/PNG + "ทำโปสเตอร์ใน Visual Studio →"
  deep-link carrying `image_prompt_en`.
- **Bonus buttons** (inside stage 4's package section): each bonus slot shows
  its idea + "สร้างเนื้อหาโบนัสเต็ม →"; result renders as an editable document
  view per slot, saved into `bonus_contents`.
- **Offer panel** (unlocked after s4, surfaced BEFORE stage 7 in the stepper's
  side rail): input = target price from the s3 value ladder → generate →
  renders as the offer one-pager (สมการคุณค่า dials, stack table with values,
  guarantee box, offer name + one-liner), everything editable; a banner on
  stage 7 nudges "สร้างข้อเสนอก่อน สคริปต์ขายจะแรงขึ้น" when `offer` is empty.
- **Lead engine panel** (unlocked after s3): renders as an action dashboard,
  not a document — channel ranking cards (with the "why this road first for
  YOU" rationale from quiz data), the daily-100 checklist, copy-ready outreach
  scripts (tap to copy, regenerate per script), give:ask cadence strip, and the
  CRM bridge button when `work_crm` is entitled.
- **แผนคอนเทนต์ 30 วัน panel** (unlocked after s4; masterclass path): pick a
  launch date → generate → renders as a 30-day calendar grid, each day card
  showing layer badge (viral/insight/sell), format icon (text/short video),
  topic + hook; per-day buttons "เขียนโพสต์เต็ม →" / "เขียนสคริปต์วิดีโอ →"
  deep-link into Content Studio prefilled; single-day regenerate (no full-plan
  re-roll just to fix one day).
- **Cross-links into existing tools** (this is where it compounds): every EP in
  s6, funnel content slot in s3, and day card in s8 gets "→ สร้างโพสต์จริงใน
  Studio" deep-link (`/studio?topic=...&template=...` — param convention already
  exists); launch plan offers "→ วางแคมเปญ 7 วัน" (Campaign Mode pre-seeded from
  the mini course); when Work+CRM entitled, "ส่ง launch checklist ไปเป็น tasks"
  (backlog if heavy). Backlog: push s8 days into the content-calendar page via
  `scheduled_date` once posts are generated.
- **Exports**: "Course Plan (1 หน้า)", "Sales Script (90 นาที)", and the full
  Lead Magnet as clean print-view routes (`/expert/[id]/plan`,
  `/expert/[id]/script`, `/expert/[id]/leadmagnet` with print CSS) — matches the
  source pack's output templates; PDF via browser print, no new dep.
- i18n chrome per M16 (generated content stays Thai per product rule).

### 19e. Verification & rollout (0.5 day)

- PGlite gate test green (19b); typecheck all.
- Live end-to-end: one real project run through all 7 stages by the user (their
  actual expertise as the test case — doubles as the first dogfood), every stage
  output eyeballed for framework fidelity vs the source pack.
- code-reviewer pass on the full diff; adversarial check on RLS + the
  stage-N-requires-N-1 enforcement (server-side, not just UI lock).
- Positioning followup (ties to 18d): Expert Studio becomes the #1 dashboard
  hero and the top Pro/Business selling point.

**Accept:** (a) masterclass path — a signed-in user goes quiz → type → DNA →
funnel → masterclass design (7 milestones + package) → module scripts → mini
course plan → sales script, all persisted, all editable, exports print clean,
cross-links land in Studio/Campaign prefilled; (b) mini-course path — quiz →
DNA → 7-EP plan → quick sales script + landing copy at ~5cr total, and
"ขยายเป็น Masterclass" carries s1/s2 data into a new full project; (c) quiz is
≤10 questions (11 on tie), all authored fresh (spot-check: zero verbatim
overlap with the source PDFs' question text); (d) lead magnet — one full asset
generated (real chapter/checklist text, not outline), editable, print view
clean; (e) 30-day plan — one live plan generated with the 80/15/5 layer ratio
verifiably enforced (count the layers), day cards deep-link into Studio
prefilled, single-day regenerate works; (f) framework — generated once, renders
correctly in all 4 SVG shapes with Thai labels crisp, downloads as SVG + PNG,
Visual Studio deep-link carries the poster prompt; (g) bonus — at least one
slot generated to a full asset (real body text) and editable; (h) offer — one
live offer generated with an itemized stack whose values sum correctly, a typed
guarantee, honest scarcity/urgency (no fabricated limits), and stage 7 run
AFTER the offer demonstrably uses offer_stack in its value stack; (i) lead
engine — channel ranking demonstrably changes with different quiz Part B
answers (test: no-audience profile vs >10k profile lead with different roads),
daily plan respects the hours/week answer, outreach scripts are in brand voice,
CRM bridge creates a pipeline when entitled; cross-user RLS test proves
isolation; nothing from the source PDFs or either Hormozi book ships verbatim
anywhere.

---

## Build order & checkpoints

M14 → M15a → M15b → M16 → M17 [all DONE] → **M18a → 18b → 18c → 18d → 18f (18e
parallel after 18a) → M19a → 19b → 19c → 19d → 19e**. One commit per milestone,
message explains WHY (match the repo's existing commit voice). After each: full
typecheck, live visual pass, and ask the user before pushing. If a live Gemini
call misbehaves (schema drift, refusals), isolate with a 3× repeat script in
`scratchpad/` before "fixing" — that's how every prompt bug in this repo was
actually diagnosed. M18-specific: 18a/18b palette + naming decisions REQUIRE user
sign-off before code; 18e ships only after the blind A/B eval in 18e-4.
Decisions LOCKED 2026-07-13: 18f replacements = Post X-Ray + Thai occasion
planner; M19 framework names = Creator DNA theme (see M19 §framework names);
M19 pricing = credits per stage (see 19c); build order = **M18 first, then M19**.
