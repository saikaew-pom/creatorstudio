// Assemble the base video (BLUEPRINT P8: NO captions burned in — captions are a
// separate JSON overlay styled in the browser, burned only at export in M6).
// B-roll clips are cut to each segment's voice duration, so concatenating both
// tracks back-to-back keeps audio and video perfectly aligned with no drift.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ffmpeg, X264 } from "./ffmpeg";

/** Concatenate per-segment voice WAVs into one continuous track. */
export async function concatVoice(wavPaths: string[], outPath: string): Promise<void> {
  const inputs = wavPaths.flatMap((p) => ["-i", p]);
  const n = wavPaths.length;
  const filter = `${wavPaths.map((_, i) => `[${i}:a]`).join("")}concat=n=${n}:v=0:a=1[out]`;
  await ffmpeg([...inputs, "-filter_complex", filter, "-map", "[out]", "-ar", "44100", outPath]);
}

/** Concatenate B-roll clips (all normalized to 1080x1920/30fps) into one video track. */
export async function concatVideo(clipPaths: string[], workDir: string, outPath: string): Promise<void> {
  const listPath = path.join(workDir, "concat.txt");
  writeFileSync(listPath, clipPaths.map((p) => `file '${p}'`).join("\n"));
  await ffmpeg([
    "-f", "concat", "-safe", "0", "-i", listPath,
    ...X264, "-r", "30", outPath,
  ]);
}

/** Mux the video track with the voice track (+ optional ducked music) → base.mp4. */
export async function muxBase(
  videoPath: string,
  voicePath: string,
  outPath: string,
  music?: { path: string }
): Promise<void> {
  if (!music) {
    await ffmpeg([
      "-i", videoPath, "-i", voicePath,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", outPath,
    ]);
    return;
  }
  // Real sidechain ducking: music volume ducks automatically under the voice
  // ("ลดเสียงใต้เสียงพูดอัตโนมัติ"), then mixed with the voice on top.
  const filter =
    `[2:a]volume=0.35[m];` +
    `[m][1:a]sidechaincompress=threshold=0.03:ratio=8:attack=150:release=400[duck];` +
    `[1:a][duck]amix=inputs=2:duration=first:dropout_transition=0[a]`;
  await ffmpeg([
    "-i", videoPath, "-i", voicePath, "-stream_loop", "-1", "-i", music.path,
    "-filter_complex", filter,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", outPath,
  ]);
}
