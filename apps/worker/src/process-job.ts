// Processes one queued preview_render job: run the pipeline, upload base.mp4, save
// captions, mark the project rendered, charge minutes. Uses the service-role client
// (the worker is trusted server code — it must read/write across users, storage, and
// minute_usage, all of which are RLS-gated for normal sessions).
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdirSync } from "node:fs";
import {
  updateJobProgress, finishJob, failJob, saveCaptions, upsertProject,
  uploadRender, addMinutes, type RenderJobRow, type ProjectRow,
} from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderPreview } from "./render/pipeline";

interface RenderPayload {
  script: string;
  voice: string;
  brollTier: "ai" | "stock";
}

export async function processJob(
  admin: SupabaseClient,
  job: RenderJobRow,
  project: ProjectRow,
  apiKey: string
): Promise<void> {
  const payload = job.payload as RenderPayload;
  const workDir = path.join(os.tmpdir(), `cs-job-${job.id}`);
  const outFile = path.join(os.tmpdir(), `cs-job-${job.id}.mp4`);
  mkdirSync(workDir, { recursive: true });

  try {
    const result = await renderPreview({
      script: payload.script,
      voice: payload.voice || "Aoede",
      brollTier: payload.brollTier || "ai",
      apiKey,
      outFile,
      workDir,
      onProgress: (pct, label) => updateJobProgress(admin, job.id, pct, label),
    });

    // Upload base.mp4 → storage.
    const bytes = readFileSync(outFile);
    const storagePath = await uploadRender(admin, job.user_id, project.id, bytes, "base");

    // Persist captions + rendered segments, mark project rendered.
    await saveCaptions(admin, project.id, result.captions);
    await upsertProject(admin, job.user_id, {
      id: project.id,
      segments: result.segments,
      status: "rendered",
    });

    // Charge minutes = ceil(actual duration / 60) — reconciled to real output (doc 04 §11).
    const minutes = Math.max(1, Math.ceil(result.durationSec / 60));
    await addMinutes(admin, job.user_id, minutes);

    await finishJob(admin, job.id, storagePath);

    // Notify (bell badge on the dashboard).
    await admin.from("notifications").insert({
      user_id: job.user_id, app: "studio", kind: "render_done",
      title_th: "วิดีโอเรนเดอร์เสร็จแล้ว — เข้าไปแต่งซับ + ส่งออกได้เลย",
      link: `/video-editor?project=${project.id}`,
    });
  } catch (e) {
    await failJob(admin, job.id, (e as Error).message.slice(0, 500));
    throw e;
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(outFile, { force: true }); } catch { /* ignore */ }
  }
}
