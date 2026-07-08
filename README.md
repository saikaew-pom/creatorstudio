# Creator Studio

AI-powered creator studio for the Thai market — two apps, one monorepo.
**Full specification: [BLUEPRINT.md](BLUEPRINT.md) + [docs/](docs/)** (read before coding).

## Status (2026-07-09)

| Piece | State |
|---|---|
| Blueprint pack (7 docs) | ✅ complete |
| `packages/prompts` — all prompt modules + zod schemas (doc 02) | ✅ typechecks, live-verified |
| `packages/ai` — Gemini router, real `responseSchema`, JSON repair, patch-merge refine | ✅ typechecks, live-verified |
| `packages/db` — full Postgres schema + RLS + credit/quota RPCs | ✅ SQL ready (not yet applied) |
| `apps/content` — dashboard + Content Studio (generate/hooks/refine/refine-all/brainstorm APIs + full result UI) | ✅ builds, **live-verified end-to-end with real Gemini key** |
| `apps/studio` — dashboard + editor steps 01–02 (script→typed segments, elements picker) | ✅ builds, UI verified |
| Supabase wiring, image gen, video render pipeline, MCP | ⬜ next (docs/06 M1, M3, M5+) |

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
