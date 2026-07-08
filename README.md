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
| `apps/studio` — dashboard + editor steps 01–02 (script→typed segments, elements picker) | ✅ builds, UI verified |
| Video render pipeline, MCP, payments | ⬜ next (docs/06 M5+; payments deferred) |

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
