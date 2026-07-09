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
import { DEFAULT_STYLE, type CaptionCard } from "@cs/captions";
import { downloadUpload } from "@cs/db";
import { renderPreview } from "./render/pipeline";
import { renderUpload } from "./render/upload-pipeline";
import { writeFileSync } from "node:fs";

interface RenderPayload {
  mode?: "script" | "upload";
  script?: string;
  voice?: string;
  brollTier?: "ai" | "stock";
  upload_path?: string;
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
    let captions: CaptionCard[];
    let durationSec: number;
    let segments: unknown = undefined;

    if (payload.mode === "upload") {
      // Upload-own-clip: download the source, normalize + transcribe (doc 04 §7).
      if (!payload.upload_path) throw new Error("ไม่มีไฟล์อัปโหลด");
      const srcExt = payload.upload_path.split(".").pop() || "mp4";
      const srcPath = path.join(workDir, `source.${srcExt}`);
      writeFileSync(srcPath, await downloadUpload(admin, payload.upload_path));
      const result = await renderUpload({
        sourcePath: srcPath, apiKey, outFile, workDir,
        onProgress: (pct, label) => updateJobProgress(admin, job.id, pct, label),
      });
      captions = result.captions;
      durationSec = result.durationSec;
    } else {
      const result = await renderPreview({
        script: payload.script ?? "",
        voice: payload.voice || "Aoede",
        brollTier: payload.brollTier || "ai",
        apiKey,
        outFile,
        workDir,
        onProgress: (pct, label) => updateJobProgress(admin, job.id, pct, label),
      });
      captions = result.captions;
      durationSec = result.durationSec;
      segments = result.segments;
    }

    // Upload base.mp4 → storage.
    const bytes = readFileSync(outFile);
    const storagePath = await uploadRender(admin, job.user_id, project.id, bytes, "base");

    // Persist captions + rendered segments, mark project rendered.
    await saveCaptions(admin, project.id, captions, DEFAULT_STYLE);
    await upsertProject(admin, job.user_id, {
      id: project.id,
      ...(segments ? { segments } : {}),
      status: "rendered",
    });

    // Charge minutes = ceil(actual duration / 60) — reconciled to real output (doc 04 §11).
    const minutes = Math.max(1, Math.ceil(durationSec / 60));
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
