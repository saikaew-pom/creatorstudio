# Build context is the repo root (monorepo — needs packages/* via workspace:*).
# Railway: builder pinned via ../../railway.json (dockerfilePath), root context stays "/".
# Node 22 (NOT 20): @supabase/supabase-js@2.110+ requires a global WebSocket, which
# only exists in Node 22+. On Node 20 the RealtimeClient constructor throws
# "native WebSocket not found" at createClient() time, crash-looping the worker.
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile --filter @cs/worker...

WORKDIR /app/apps/worker
CMD ["pnpm", "worker"]
