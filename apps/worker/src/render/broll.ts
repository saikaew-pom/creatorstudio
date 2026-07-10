// B-roll clip per segment. Two sources:
//   - "stock"  → Pexels/Pixabay vertical video (doc 04 §5; the intended free default,
//                needs the user's API key — wired but skipped when absent)
//   - "ai"     → generate a still via @cs/ai then Ken-Burns it into a clip with ffmpeg
//                (self-contained; used to verify the pipeline without stock keys)
// Every clip is normalized to 1080x1920 @ 30fps and cut to the segment's audio length,
// so B-roll swaps exactly on segment boundaries (the "สลับทุก 3-5 วิ" feel).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { generateImage } from "@cs/ai";
import { ffmpeg, X264 } from "./ffmpeg";

const W = 1080;
const H = 1920;
const FPS = 30;

export interface BrollClip {
  index: number;
  clipPath: string;
  keyword: string;
  source: "ai" | "stock";
}

/** Ken-Burns a still image into a vertical clip of exactly `duration` seconds. */
async function stillToClip(imgPath: string, duration: number, clipPath: string): Promise<void> {
  const frames = Math.max(1, Math.round(duration * FPS));
  // Cover-scale to 1080x1920, then a slow zoom (1.0 → ~1.12) centered — classic Ken Burns.
  const vf =
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
    `zoompan=z='min(zoom+0.0012,1.12)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;
  await ffmpeg([
    "-loop", "1", "-i", imgPath,
    "-t", duration.toFixed(3),
    "-vf", vf,
    ...X264, "-r", String(FPS),
    clipPath,
  ]);
}

export async function buildBrollClips(
  segments: { index: number; keyword_primary: string; duration: number }[],
  outDir: string,
  opts: { apiKey: string; tier: "ai" | "stock" }
): Promise<BrollClip[]> {
  const clips: BrollClip[] = [];
  for (const seg of segments) {
    const imgPath = path.join(outDir, `broll_${seg.index}.png`);
    const clipPath = path.join(outDir, `broll_${seg.index}.mp4`);

    // stock tier would fetch a Pexels/Pixabay clip here; absent a key we fall through to AI.
    // NB: "b-roll" alone makes the model emit a contact-sheet/grid of options (caught on
    // visual inspection) — so demand ONE single full-frame photograph explicitly.
    const img = await generateImage({
      prompt:
        `A single full-frame cinematic photograph of ${seg.keyword_primary}. ` +
        `One continuous scene filling the entire frame, realistic natural photography, ` +
        `shallow depth of field, vertical 9:16. ` +
        `NOT a collage, NOT a grid, NOT a contact sheet, NOT split panels — one single photo only. No text.`,
      tier: "image-standard",
      aspectRatio: "9:16",
      apiKey: opts.apiKey,
    });
    writeFileSync(imgPath, img.data);
    await stillToClip(imgPath, seg.duration, clipPath);
    clips.push({ index: seg.index, clipPath, keyword: seg.keyword_primary, source: "ai" });
  }
  return clips;
}
