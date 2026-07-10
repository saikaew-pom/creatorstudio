# Deploying Creator Studio

Monorepo: two Next.js apps (`apps/content`, `apps/studio`) + a background worker
(`apps/worker`) + shared `packages/*`. Supabase is already live. Below: GitHub → Vercel
for the two web apps, and where the worker has to run (NOT Vercel).

## 0. Secrets — never commit them
`.env` is gitignored and verified clean of secrets in all history. Every deploy target
gets its env vars set **in that platform's dashboard**, never in the repo. Required vars
are listed in [.env.example](.env.example).

## 1. GitHub
Already wired: `origin = github.com/saikaew-pom/creatorstudio.git`. Push with `git push`.

## 2. Vercel — two projects from the one repo
Vercel deploys one app per project. Create **two** projects, both importing this repo:

| Project | Root Directory | Notes |
|---|---|---|
| `creatorstudio-content` | `apps/content` | Content Engine (port 3100 locally) |
| `creatorstudio-studio`  | `apps/studio`  | Video Studio (port 3200 locally) |

For each project (Import Git Repository → this repo → **Root Directory** = the app dir):
- **Framework**: Next.js (auto-detected).
- **Install/Build**: leave as default — Vercel detects the pnpm workspace from the repo
  root and installs all `packages/*` (the apps import them via `workspace:*` +
  `transpilePackages`, so no build step is needed for the packages themselves).
- If the build can't resolve `@cs/*`, turn ON **Settings → Build → "Include files outside
  the root directory"** (needed so Vercel pulls in `packages/*` and the root lockfile).
- **Environment Variables** (Settings → Environment Variables) — set these (values from
  your `.env`, same Supabase project):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both apps)
  - `SUPABASE_SERVICE_ROLE_KEY` (both apps — server routes use it)
  - `GEMINI_API_KEY` (both apps — content generation + image; studio enqueues only)
  - `PIXABAY_API_KEY` / `PEXELS_API_KEY` (studio, once stock B-roll is wired)
- **Supabase Auth redirect**: add each deployed URL's `/auth/callback` to Supabase →
  Auth → URL Configuration → Redirect URLs, and set Site URL. For Google login, add the
  same callback in the Google provider.

`next.config.mjs` loads the root `.env` only for local dev (`dotenv` no-ops when the file
is absent), so Vercel's injected env vars are used as-is — no change needed.

## 3. The worker — must run somewhere persistent (NOT Vercel)
`apps/worker` polls `render_jobs` and runs minutes-long ffmpeg renders. Vercel is
serverless (no long-lived process), so the worker runs on **Railway / Fly / Render / a
small VM** instead. A ready-to-use `apps/worker/Dockerfile` (Node 20 + ffmpeg via apt) is
already in the repo — build context is the repo root (needed for the `packages/*`
workspace deps).

**Railway (recommended, ~$5/mo usage-based):**
1. Railway → New Project → **Deploy from GitHub repo** → this repo.
2. Settings → Build: set **Dockerfile Path** = `apps/worker/Dockerfile`, root context
   stays the repo root (default) — do NOT set a Root Directory, since the Dockerfile
   needs `packages/*` alongside `apps/worker`.
3. Settings → Environment Variables:
   - `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `MINIMAX_API_KEY` (TTS — default provider, see [.env.example](.env.example))
4. No public networking/domain needed — it's a background poller, not a web server.
5. Deploy. Check logs for the worker's poll loop starting with no errors.

Fly/Render work the same way: point them at `apps/worker/Dockerfile` with the repo root
as build context, same env vars, no exposed port needed.

**Until the worker is deployed**, the web apps work end-to-end EXCEPT video renders/exports
will sit in `queued` (nothing processes them). Everything else — content kits, images,
brand/style, viral templates, auth, credits — works on Vercel alone.

## 4. Post-deploy smoke test
1. Sign up on the content app URL → confirm the profile + 20 credits (signup trigger).
2. Generate a content kit → verify it appears in /history.
3. On the studio app, create a render → it should queue; once the worker is up, it
   completes and the caption studio opens.

## Known deferred (see README "deferred"): payments, storage retention cron, stock B-roll,
Whisper karaoke, MCP OAuth, analytics, admin tools.
