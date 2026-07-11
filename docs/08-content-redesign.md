# 08 — Content Engine Redesign Blueprint (M14–M17)

Handover spec for executing models (Opus/Sonnet). Target app: **`apps/content`**
(live: creatorstudio99.vercel.app). Four goals, in build order:

| Milestone | Goal |
|---|---|
| M14 | Notion-style UI redesign (clean professional SaaS) |
| M15 | Repurpose & differentiate — template system → "Content Recipes" + Campaign Mode |
| M16 | Bilingual UI (TH/EN) via static i18n dictionary |
| M17 | Settings page: Profile · API Keys (BYO, server-side) · Agent/MCP |

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

## M14 — Notion-style UI redesign

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

## M15 — Repurpose & differentiate ("not copy & paste")

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

## M16 — Bilingual UI (TH/EN)

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

## M17 — Settings page (content app): Profile · API Keys · Agent/MCP

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

## Build order & checkpoints

M14 → M15a → M15b → M16 → M17. One commit per milestone, message explains WHY
(match the repo's existing commit voice). After each: full typecheck, live visual
pass, and ask the user before pushing. If a live Gemini call misbehaves (schema
drift, refusals), isolate with a 3× repeat script in `scratchpad/` before "fixing"
— that's how every prompt bug in this repo was actually diagnosed.
