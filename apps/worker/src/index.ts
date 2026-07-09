// Render worker: polls render_jobs for queued work and processes one at a time
// (doc 04 §1 concurrency: 1 render per user; this simple loop does 1 globally, fine
// for MVP). In production this runs as a persistent process (Railway/Fly), NOT
// serverless — renders are minutes-long. Run: pnpm --filter @cs/worker worker
import { adminClient, getProject, type RenderJobRow } from "@cs/db";
import { processJob } from "./process-job";

const POLL_MS = 4000;
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error("GEMINI_API_KEY missing"); process.exit(1); }

const admin = adminClient();

async function tick(): Promise<void> {
  const { data: jobs } = await admin
    .from("render_jobs")
    .select("*")
    .eq("status", "queued")
    .eq("kind", "preview_render")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = jobs?.[0] as RenderJobRow | undefined;
  if (!job) return;

  console.log(`[worker] picked job ${job.id} (project ${job.project_id})`);
  // Claim it immediately so a second worker won't double-process.
  await admin.from("render_jobs").update({ status: "running" }).eq("id", job.id);

  const project = await getProject(admin, job.project_id);
  if (!project) { await admin.from("render_jobs").update({ status: "failed", error: "project not found" }).eq("id", job.id); return; }

  try {
    await processJob(admin, job, project, apiKey!);
    console.log(`[worker] job ${job.id} done`);
  } catch (e) {
    console.error(`[worker] job ${job.id} failed:`, (e as Error).message);
  }
}

// WORKER_ONCE=1 processes a single job then exits (used for verification/CI); the
// default is a persistent poll loop for production.
const once = process.env.WORKER_ONCE === "1";

console.log(once ? "[worker] one-shot mode" : "[worker] polling render_jobs…");
if (once) {
  await tick();
  process.exit(0);
}
// eslint-disable-next-line no-constant-condition
while (true) {
  try { await tick(); } catch (e) { console.error("[worker] tick error:", (e as Error).message); }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
