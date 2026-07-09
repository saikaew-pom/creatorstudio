// Upload-own-clip pipeline (doc 04 §7). Normalizes the user's vertical clip to
// 1080x1920, keeps the ORIGINAL audio continuous, transcribes it to Thai caption
// cards. The base.mp4 is just the normalized clip (captions are the browser overlay /
// export burn, same as script mode). B-roll insertion into upload clips is a documented
// follow-up — captioning your own footage is the core value here.
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ffmpeg, ffprobeDuration } from "./ffmpeg";
import { transcribeClip } from "./transcribe";
import type { CaptionCard } from "@cs/captions";

export interface UploadRenderInput {
  sourcePath: string; // local path to the downloaded upload
  apiKey: string;
  outFile: string;
  workDir?: string;
  onProgress?: (pct: number, label: string) => void | Promise<void>;
}

export interface UploadRenderResult {
  basePath: string;
  durationSec: number;
  captions: CaptionCard[];
}

export async function renderUpload(input: UploadRenderInput): Promise<UploadRenderResult> {
  const workDir = input.workDir ?? path.join(os.tmpdir(), `cs-upload-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const progress = async (p: number, l: string) => { await input.onProgress?.(p, l); };

  await progress(10, "กำลังเตรียมคลิป");
  // Normalize to 1080x1920 (cover-crop), keep audio. yuv420p for compatibility.
  await ffmpeg([
    "-i", input.sourcePath,
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k",
    input.outFile,
  ]);
  const durationSec = await ffprobeDuration(input.outFile);

  await progress(45, "กำลังถอดเสียงเป็นซับ");
  const segs = await transcribeClip(input.outFile, workDir, input.apiKey);

  await progress(90, "กำลังจับเวลาซับ");
  const captions: CaptionCard[] = segs.map((s, i) => ({
    idx: i,
    start_ms: Math.round(s.start * 1000),
    end_ms: Math.round(s.end * 1000),
    text: s.text,
    type: i === 0 ? "hook" : "normal",
  }));

  await progress(100, "เสร็จแล้ว");
  return { basePath: input.outFile, durationSec, captions };
}
