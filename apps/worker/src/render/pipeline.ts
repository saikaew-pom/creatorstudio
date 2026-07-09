// Preview-render pipeline (doc 04 §1). Orchestrates the 6 steps and reports progress
// via onProgress so render_jobs.progress/step_label update as it runs. Produces a
// base.mp4 (no captions) + caption cards. Pure orchestration over the verified pieces.
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { brollKeywords, splitScript, type Segment } from "@cs/prompts";
import { run } from "@cs/ai";
import { synthesizeSegments } from "./tts";
import { buildBrollClips } from "./broll";
import { concatVoice, concatVideo, muxBase } from "./assemble";
import { buildSegmentCaptions, type CaptionCard } from "./captions";
import { ffprobeDuration } from "./ffmpeg";

export interface RenderInput {
  script: string;
  voice: string; // Gemini voice id
  brollTier: "ai" | "stock";
  musicPath?: string;
  apiKey: string;
  outFile: string; // final base.mp4 path
  workDir?: string;
  onProgress?: (pct: number, label: string) => void | Promise<void>;
}

export interface RenderResult {
  basePath: string;
  durationSec: number;
  captions: CaptionCard[];
  segments: Segment[];
}

export async function renderPreview(input: RenderInput): Promise<RenderResult> {
  const workDir = input.workDir ?? path.join(os.tmpdir(), `cs-render-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const progress = async (p: number, l: string) => { await input.onProgress?.(p, l); };

  try {
    // 1. Segment the script (1 line = 1 segment, first = HOOK).
    await progress(5, "กำลังเตรียมสคริปต์");
    const segments = splitScript(input.script);
    if (segments.length === 0) throw new Error("สคริปต์ว่างเปล่า");

    // 2. TTS per segment → per-segment WAV + exact durations.
    await progress(20, "กำลังสร้างเสียงพากย์");
    const tts = await synthesizeSegments(
      segments.map((s) => ({ index: s.idx, text: s.text })),
      input.voice, workDir, input.apiKey
    );
    const durById = new Map(tts.map((t) => [t.index, t.duration]));
    const timedSegments = segments.map((s) => ({ ...s, duration: durById.get(s.idx) ?? 2 }));

    // 3. Caption cards from segment-level timing (no Whisper needed).
    await progress(40, "กำลังจับเวลาซับ");
    const captions = buildSegmentCaptions(
      timedSegments.map((s) => ({ index: s.idx, text: s.text, type: s.type, duration: s.duration }))
    );

    // 4. B-roll keywords (VD.1) → one clip per segment.
    await progress(55, "กำลังหาภาพประกอบ");
    const kw = await run(brollKeywords, {
      project_title: segments[0].text.slice(0, 60),
      segments: segments.map((s) => ({ type: s.type, text: s.text })),
    }, { apiKey: input.apiKey });
    const kwByIdx = new Map(kw.output.segments.map((s, i) => [i, s.keyword_primary]));
    const clips = await buildBrollClips(
      timedSegments.map((s) => ({
        index: s.idx,
        keyword_primary: kwByIdx.get(s.idx) ?? segments[s.idx].text.slice(0, 40),
        duration: s.duration,
      })),
      workDir, { apiKey: input.apiKey, tier: input.brollTier }
    );

    // 5. Assemble: concat voice + concat video → mux (+ optional ducked music).
    await progress(80, "กำลังประกอบวิดีโอ");
    const voicePath = path.join(workDir, "voice.wav");
    const videoPath = path.join(workDir, "video.mp4");
    await concatVoice(tts.map((t) => t.wavPath), voicePath);
    await concatVideo(
      clips.sort((a, b) => a.index - b.index).map((c) => c.clipPath),
      workDir, videoPath
    );
    await muxBase(videoPath, voicePath, input.outFile, input.musicPath ? { path: input.musicPath } : undefined);

    await progress(100, "เสร็จแล้ว");
    return {
      basePath: input.outFile,
      durationSec: await ffprobeDuration(input.outFile),
      captions,
      segments: timedSegments,
    };
  } finally {
    // Clean up the auto-created scratch dir. When the caller passes an explicit
    // workDir (e.g. the verify script), it owns cleanup and we leave it for inspection.
    if (!input.workDir) {
      try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
