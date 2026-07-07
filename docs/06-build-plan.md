# 06 — BUILD PLAN (milestones for the executing model)

Rules of engagement: BLUEPRINT §5. One milestone per session/branch. Each milestone ends with
its acceptance tests demonstrably passing (screenshot or JSON output pasted in the report).

## M0 — Skeleton (0.5 day)
Monorepo per BLUEPRINT §2; Supabase project + doc-03 migrations; auth (email + Google);
`packages/ui` tokens + shell layouts for both apps; deploy both apps to Vercel with health page.
**Accept**: sign up → see empty dashboards on both subdomains; RLS verified (user B cannot
read user A's rows via API).

## M1 — Credits, quotas, settings (1 day)
Credit ledger + RPCs (`try_consume_daily_use`, `debit_credits`, refund) with unit tests;
model_costs seeding; /credits page with packs (Stripe/Omise checkout) + history list; studio
Settings → API Keys tab (vault storage + live "ทดสอบ" validation for Pexels/Pixabay).
**Accept**: buy test pack → balance updates via ledger only; failed generation refunds; daily
counter enforces 30/day and banner shows remainder; invalid Pexels key shows "ยังไม่ตั้ง"/error.

## M2 — Prompt engine core + Content Studio (2 days) ⭐
`packages/prompts` with doc-02 modules §0, A, B, C, R (verbatim), zod schemas, provider
router, JSON-repair; /studio form (spec 01 §A3) → kit generation → full result UI with
copy/regen/refine per section + refine-all; generations + versions persisted; reopen via
?jobId.
**Accept**: doc-02 QA evals 1, 2, 3 pass (paste outputs); refine-all leaves untouched sections
byte-identical (automated diff assertion); topic from dashboard quick-start flows through.

## M3 — Image Studio + visual prompt image generation (1.5 days)
§I enhancement prompt + image provider calls (standard/pro routing, credit debit);
/image-studio composer (ref image, niche, model, aspect, cost tag); inline cover generation
inside Content Studio's Visual tab with Thai-text checkbox; My Works (/history) with filters;
Folders; Calendar (drag to date).
**Accept**: QA eval 4 passes; generated image lands in history with prompt_rendered stored;
regenerate reuses stored prompt; credits 1 vs 5 debited correctly.

## M4 — Brand Voice, Style Cloner, templates, inspiration (2 days)
Brand wizard (§BV) + brand assets upload + BRAND_BLOCK injection; Style Cloner (§SC) +
STYLE_BLOCK; templates table + admin CRUD + seed 12 visual + 12 viral templates (doc 02 §T,
incl. RoastMaster worked example); /viral-studio gallery + detail + kit generation;
/inspiration + remix prefill + Hero-of-the-week on dashboard; onboarding checklist + streak.
**Accept**: QA evals 6, 7, 8 pass; brand-on vs brand-off captions visibly differ (eval 2
rerun); template usage_count increments; inspiration remix opens Image Studio prefilled.

## M5 — Studio editor steps 1–2 + preview render (3 days)
Projects CRUD + autosave; step-01 script→segments (typed HOOK, live counters, drag reorder);
step-02 elements UI (voice list w/ samples, music moods w/ preview player, B-roll tier cards
— AI tiers flagged "เร็วๆ นี้"); worker: TTS (§2) → alignment (§3) → chunking (§4) → B-roll
(§5, VD.1 prompt) → Remotion base render; job progress UI + notifications + minute charging.
**Accept**: QA eval 5 passes; a 2-line Thai script renders end-to-end to a base.mp4 with
audible Thai voice, music ducking under speech, B-roll switching every 3-5s; job survives tab
close; minutes ledger reconciles.

## M6 — Caption studio + export (2.5 days)
Step-03 three-pane UI + timeline; caption cards CRUD (edit/merge/split, chunk-mode switch
with warning); CaptionStyle system with ALL presets/themes/effects as shared React components
(doc 04 §6); live preview overlay with drag positioning + keyboard shortcuts; export job
(burn) + gallery + retention cron.
**Accept**: editing caption text updates preview <100ms without any render job; each of the
11 themes visually distinct in a screenshot grid; export mp4 shows styled captions matching
preview; "กำลังฝังซับ %" progress live.

## M7 — Upload-own-clip mode + MCP server (2 days)
§7 upload pipeline (transcribe→cards→alternating B-roll, original audio continuous);
/api/mcp with OAuth + token auth and doc-04 §10 tools; Settings → Agent/MCP tab with endpoint,
agent picker instructions, token management.
**Accept**: uploaded talking clip gets aligned Thai captions + B-roll inserts; Claude Desktop
custom connector completes OAuth and `create_video` → `get_job_status` → `get_download_url`
round-trip produces a playable file; missing Pexels key returns the guiding Thai error.

## M8 — Polish & launch (1.5 days)
Plans/pricing pages + upgrade flows; notification bell both apps; help center content
(spec 01 §B4); light theme pass; mobile pass on dashboard/studio-form/history; error states
audit (doc 05 §5); analytics events (generation, refine, template_use, render, export);
admin: feature-to-inspiration, music upload.
**Accept**: Lighthouse ≥85 on dashboards; full new-user journey (signup → brand → kit →
image → video → export → download) recorded as a GIF with zero dead-ends.

## Backlog (post-launch, do not build now)
AI B-roll tiers (ผสม/เต็มที่) · HeyGen avatar · music generation templates · gift credits ·
team workspaces · scheduler auto-posting to platforms · Content Engine MCP server.
