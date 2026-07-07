# Creator Studio

AI-powered creator studio for the Thai market — two apps, one monorepo.
**Full specification: [BLUEPRINT.md](BLUEPRINT.md) + [docs/](docs/)** (read before coding).

## Status (auto-built overnight, 2026-07-08)

| Piece | State |
|---|---|
| Blueprint pack (7 docs) | ✅ complete |
| `packages/prompts` — all prompt modules + zod schemas (doc 02) | ✅ typechecks |
| `packages/ai` — Gemini router, JSON mode, schema repair, section lock | ✅ typechecks |
| `packages/db` — full Postgres schema + RLS + credit/quota RPCs | ✅ SQL ready (not yet applied) |
| `apps/content` — dashboard + Content Studio (generate/hooks/refine/refine-all/brainstorm APIs + full result UI) | ✅ builds, UI verified |
| `apps/studio` — dashboard + editor steps 01–02 (script→typed segments, elements picker) | ✅ builds, UI verified |
| Supabase wiring, image gen, video render pipeline, MCP | ⬜ next (docs/06 M1, M3, M5+) |

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

1. **Smoke-test generation**: add `GEMINI_API_KEY`, run `/studio`, generate a kit, try
   refine-all — compare against doc 02 §QA evals 1–3.
2. **M1**: create a Supabase project, apply `packages/db/migrations/0001_init.sql`, wire auth
   + persistence at the `TODO(M1)` markers in `apps/content/app/api/*`.
3. **M3–M8**: follow the build plan; hand milestones to Opus/Sonnet with the BLUEPRINT §5
   handover protocol.
