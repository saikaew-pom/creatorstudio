# Creator Studio

AI-powered creator studio for the Thai market — two apps, one monorepo.
**Full specification: [BLUEPRINT.md](BLUEPRINT.md) + [docs/](docs/)** (read before coding).

## Status (2026-07-09)

| Piece | State |
|---|---|
| Blueprint pack (7 docs) | ✅ complete |
| `packages/prompts` — all prompt modules + zod schemas (doc 02) | ✅ typechecks, live-verified |
| `packages/ai` — Gemini router, real `responseSchema`, JSON repair, patch-merge refine | ✅ typechecks, live-verified |
| `packages/db` — full Postgres schema + RLS + credit/quota/refund RPCs + storage + client layer + auth | ✅ **verified against real Postgres (PGlite) with RLS actually enforced, 30/30** |
| `apps/content` — Content/Image/Viral Studio + Brand Voice + Style Cloner + auth + /credits + /history + /collections + /calendar | ✅ **M1 + M3 + M4-core live-verified on hosted Supabase** (see below) |
| `apps/studio` — editor (script/upload → render → caption studio → export) + settings/MCP + auth | ✅ **M5–M7 render/caption/export/upload live-verified** |
| `apps/worker` — preview-render + export burn + **upload-clip transcribe** + job worker | ✅ **all three paths verified producing real mp4** |
| `packages/captions` — shared caption styling (11 themes) → CSS (preview) + SVG (burn) | ✅ **one source of truth, preview↔export parity** |
| MCP server — agents drive video (`/api/mcp`, 8 tools, bearer auth) | ✅ **full agent loop verified via curl** |
| Notifications, light theme, pricing, inspiration (M8) | ✅ **bell + theme + pages verified live** |
| Payments (Stripe/Omise), Lighthouse/GIF capture, analytics, admin tools | ⬜ deferred (payments = sensitive/keys) |

**🎉 M0–M8 all built and verified end-to-end on hosted Supabase.** Both apps compile, build,
and were driven through the real browser + worker + DB at each milestone. The full journey works:
signup → brand voice → content kit → image → viral template → video render (script *or* uploaded
clip) → caption studio (11 themes, live overlay) → export burn → download — plus agents can drive
the whole video pipeline over MCP.

**M6 live-verified (2026-07-09):** ffmpeg here has no libass/drawtext, so captions burn via a
cleaner route that also guarantees preview↔export parity — each card renders to a transparent
PNG (via `@resvg/resvg-js` from the shared `cardToSvg`), ffmpeg overlays it timed to the card;
the browser preview uses `styleToCss` from the *same* `resolveStyle`. Verified by producing and
inspecting real files: @resvg renders Thai correctly (combining marks), the export burn puts a
styled Thai caption over the video with the HOOK word in the emphasis color, all 11 themes are
visually distinct, and the **export worker job** ran end-to-end (base.mp4 → burned final.mp4 in
storage, project `exported`, notification). Caught + fixed a mid-word Thai wrap bug
(`Intl.Segmenter` word boundaries). The step-03 caption studio UI (live CSS overlay + theme/
font/position controls + export) typechecks and builds; its overlay shares the verified style
functions. Known simplifications: emphasis is per-card (hook/cta), not per-keyword highlight;
word-level karaoke/animations deferred.

**M5 live-verified (2026-07-09, hosted Supabase):** all tools verified live first (ffmpeg 8.1,
Gemini TTS for Thai, Gemini images). Ran the real worker against a real queued job:
enqueue → `render_jobs` → worker → per-segment TTS → segment-timed caption cards → B-roll
keywords + AI Ken-Burns clips → ffmpeg assemble → **base.mp4 (1080×1920 H.264 + AAC, real
−16dB voice) uploaded to the `renders` bucket** → captions saved → project rendered → minutes
charged → notification. Also verified through the **studio UI**: signed in → editor → render
button → `POST /api/render` 200 → status polling → worker completed → video in storage +
notification. Two bugs caught live and fixed: captions silently saving zero cards (migration
0004 unique constraint + `saveCaptions` now throws on error — same swallowed-error class as the
M3 refund bug), and a transient TTS blip correctly failing the job (not a silent success).
Frame-by-frame inspection caught the image model emitting contact-sheets for "b-roll" prompts —
fixed to demand a single photo. Verified pieces: worker one-shot (`WORKER_ONCE=1`), migration
test 32/32, `render-once` produces an inspectable mp4.

**Known M5 gaps (non-blocking):** editor polling doesn't survive a tab reload yet (needs jobId
persistence / the dashboard "render done" reconnect via the notification that already fires);
B-roll uses AI images (Pexels/Pixabay stock is the intended free default — wired, needs the
user's key); captions are segment-level (word-level Whisper karaoke is M6); music library +
ducking is wired in ffmpeg but not hooked to a track picker; the worker runs on-demand here
(deploy as a persistent Railway/Fly process for production).

**M4-core live-verified (2026-07-09, hosted Supabase):** created a brand via the wizard
(told a Thai story → AI extracted name/audience/tone/pronoun, flagged 4 fields as guessed →
saved) → generated content in Content Studio with that brand selected → **output unmistakably
in the brand voice** ("เฮียหมี", "น้อง", "จ้า", banned word "พรีเมียม" absent), proving
BRAND_BLOCK injection through the full chain (brand loaded server-side by id, RLS-scoped) →
Viral Studio gallery listed all templates → generated a RoastMaster kit → **usage_count
incremented 0→1** and the kit persisted. QA evals 6/7/8 pass in the harness (11/11 each);
eval 2 (brand tone-shift) green. Deferred to a follow-up: Inspiration gallery + remix prefill
+ Hero-of-the-week, and the dashboard onboarding checklist + streak (lower-risk curation/polish;
need admin-curated content to be meaningful).

Regression harnesses: `scripts/eval-brand-style.mjs`, `scripts/eval-viral-kit.mjs`
(run with `set -a && source .env && set +a && npx tsx scripts/eval-*.mjs`).

**M1 live-verified (2026-07-08, hosted Supabase):** signed up a confirmed user → signup
trigger auto-created the profile + granted 20 monthly credits → signed in through the browser
(middleware/session/cookies) → `/credits` rendered the real 20 from the ledger → generated a
content kit → it persisted to `generations` and the daily quota row incremented → RLS confirmed
to block anon reads → test user deleted, FK cascade cleaned up every child row.

**M3 live-verified (2026-07-09, hosted Supabase):** image models chosen by testing the real API
(standard = `gemini-2.5-flash-image`, pro = `gemini-3.1-flash-image` for Thai-in-image). Signed
in → generated a Thai-text poster (pro tier) → image rendered with correct legible Thai text →
uploaded to Supabase Storage + served via public URL → credits debited 20→15 → persisted to
`generations` (model/asset_path/prompt_id/credits all correct) → appeared in `/history` → test
user + storage object cleaned up. Two RLS bugs found live and fixed (storage upload, credit
refund) — see migration 0003 and the git log. Payments remain a disabled "เร็วๆ นี้" button.

**Known gaps (non-blocking, for later):**
- Storage objects are NOT cascade-deleted when a user/generation is deleted (Supabase Storage
  doesn't FK-cascade). Needs a cleanup trigger or scheduled sweep before production.
- `generations` bucket is public with UUID-unguessable paths — fine for AI marketing images, but
  brand-asset uploads (personal photos, M4) should move to private storage + signed URLs.

### One-time Supabase setup (required to enable auth + persistence + credits)

1. Fill `.env` with your project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API).
2. Apply the schema: open your project's **SQL Editor** and run
   `packages/db/migrations/_apply_all.generated.sql` (0001 + 0002 + 0003 combined; regenerate any
   time with `cat packages/db/migrations/000*.sql > packages/db/migrations/_apply_all.generated.sql`).
   This is the standard hosted-Supabase DDL path — PostgREST can't run raw SQL, so it's a
   dashboard paste.
3. Create the storage bucket for generated images (once):
   `curl -X POST "$URL/storage/v1/bucket" -H "authorization: Bearer $SERVICE_ROLE" -H "apikey: $SERVICE_ROLE" -H "content-type: application/json" -d '{"id":"generations","name":"generations","public":true,"file_size_limit":10485760,"allowed_mime_types":["image/png","image/jpeg","image/webp"]}'`
4. (For Google login) enable the Google provider in Auth → Providers and add
   `<app-url>/auth/callback` as a redirect URL.

Until step 2 is done the app runs in **degraded mode**: UI + AI generation work, but there's no
login, no saved history, and no credit ledger (exactly the pre-M1 behavior).

**Live verification**: `scripts/eval-content-kit.mjs` runs doc-02 §QA evals against the real
Gemini API — 20/20 passing across two independent runs, confirming: full content kit generates
correctly first try, brand voice changes tone/pronoun and respects banned words, and refine
(both single-section and refine-all) leaves untouched sections byte-identical **by
construction** (patch-based merge — see docs/02-prompt-engine.md §R for why the original
"echo the full kit back" design was replaced after live testing caught real corruption).

Run it yourself: `set -a && source .env && set +a && npx tsx scripts/eval-content-kit.mjs`

## Run it

```bash
npm i -g pnpm@9        # once
pnpm install
cp .env.example .env   # ⚠️ add your GEMINI_API_KEY — required for generation
pnpm dev:content       # → http://localhost:3100
pnpm dev:studio        # → http://localhost:3200
```

Without `GEMINI_API_KEY` the UIs work but generation returns a Thai error message.

## Next steps (in order — docs/06-build-plan.md)

1. **M1**: create a Supabase project, apply `packages/db/migrations/0001_init.sql`, wire auth
   + persistence at the `TODO(M1)` markers in `apps/content/app/api/*`.
2. **M3–M8**: follow the build plan; hand milestones to Opus/Sonnet with the BLUEPRINT §5
   handover protocol.
