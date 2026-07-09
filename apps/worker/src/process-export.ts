// Processes an export job (doc 04 §8): download the base.mp4, burn the caption cards
// with the saved style, upload final.mp4, mark exported, notify. No minute charge —
// already paid at preview. Uses the service-role client (trusted server code).
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  updateJobProgress, finishJob, failJob, upsertProject,
  uploadRender, publicRenderUrl, type RenderJobRow, type ProjectRow,
} from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_STYLE, type CaptionCard, type CaptionStyle } from "@cs/captions";
import { burnCaptions } from "./render/export";

export async function processExport(
  admin: SupabaseClient,
  job: RenderJobRow,
  project: ProjectRow
): Promise<void> {
  const workBase = path.join(os.tmpdir(), `cs-exp-${job.id}-base.mp4`);
  const outFile = path.join(os.tmpdir(), `cs-exp-${job.id}.mp4`);
  try {
    await updateJobProgress(admin, job.id, 5, "กำลังเตรียมไฟล์");

    // Load captions (cards + style) for the project.
    const { data: cap } = await admin.from("captions").select("cards, style").eq("project_id", project.id).maybeSingle();
    if (!cap) throw new Error("ยังไม่มีซับสำหรับโปรเจกต์นี้");
    const cards = cap.cards as CaptionCard[];
    // Merge over DEFAULT_STYLE: the stored style may be partial (e.g. set_caption_style
    // saves only {theme, pos}) — missing font_size_px etc. would make the burn's
    // positioning NaN and dump the caption at y=0. Defaults guarantee a complete style.
    const style: CaptionStyle = { ...DEFAULT_STYLE, ...((cap.style as Partial<CaptionStyle>) ?? {}) };

    // Download the base render (stored at user/project/base.mp4, public bucket).
    const basePath = publicRenderUrl(admin, `${project.user_id}/${project.id}/base.mp4`);
    const res = await fetch(basePath);
    if (!res.ok) throw new Error("โหลดวิดีโอฐานไม่สำเร็จ");
    writeFileSync(workBase, Buffer.from(await res.arrayBuffer()));

    // Burn.
    await burnCaptions({
      basePath: workBase, cards, style, outFile,
      onProgress: (p, l) => updateJobProgress(admin, job.id, p, l === "เสร็จแล้ว" ? "กำลังฝังซับ" : l),
    });

    // Upload final.mp4 + mark exported.
    const bytes = readFileSync(outFile);
    const storagePath = await uploadRender(admin, project.user_id, project.id, bytes, "final");
    await upsertProject(admin, project.user_id, { id: project.id, status: "exported" });
    await finishJob(admin, job.id, storagePath);
    await admin.from("notifications").insert({
      user_id: project.user_id, app: "studio", kind: "export_done",
      title_th: "วิดีโอส่งออกเสร็จแล้ว — ดาวน์โหลดได้เลย",
      link: `/video-editor?project=${project.id}`,
    });
  } catch (e) {
    await failJob(admin, job.id, (e as Error).message.slice(0, 500));
    throw e;
  } finally {
    try { rmSync(workBase, { force: true }); } catch { /* ignore */ }
    try { rmSync(outFile, { force: true }); } catch { /* ignore */ }
  }
}
