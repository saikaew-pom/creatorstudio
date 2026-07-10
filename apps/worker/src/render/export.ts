// Export = burn captions onto the base video (doc 04 §8). Each caption card becomes a
// full-frame transparent PNG (rendered from the SHARED @cs/captions cardToSvg, so it
// matches the browser preview exactly), then ffmpeg overlays each PNG onto base.mp4 for
// its time window. No minute charge (already paid at preview). No text filters needed in
// ffmpeg (this build lacks libass/drawtext) — only the always-present `overlay` filter.
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Resvg } from "@resvg/resvg-js";
import { cardToSvg, type CaptionCard, type CaptionStyle } from "@cs/captions";
import { ffmpeg, X264 } from "./ffmpeg";

const W = 1080;
const H = 1920;

export interface ExportInput {
  basePath: string; // the rendered base.mp4 (no captions)
  cards: CaptionCard[];
  style: CaptionStyle;
  outFile: string;
  onProgress?: (pct: number, label: string) => void | Promise<void>;
}

export async function burnCaptions(input: ExportInput): Promise<void> {
  const workDir = path.join(os.tmpdir(), `cs-export-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  try {
    await input.onProgress?.(10, "กำลังสร้างซับ");
    // Rasterize each card to a transparent full-frame PNG.
    const pngPaths: string[] = [];
    for (const card of input.cards) {
      const svg = cardToSvg(input.style, card, W, H);
      const png = new Resvg(svg, {
        background: "rgba(0,0,0,0)",
        font: { loadSystemFonts: true, defaultFontFamily: input.style.font_family || "Sarabun" },
      }).render().asPng();
      const p = path.join(workDir, `cap_${card.idx}.png`);
      writeFileSync(p, png);
      pngPaths.push(p);
    }

    await input.onProgress?.(40, "กำลังฝังซับ");
    // Build the overlay chain: base ⊕ each caption, gated by its time window.
    const inputs = ["-i", input.basePath, ...pngPaths.flatMap((p) => ["-i", p])];
    let filter = "";
    let last = "0:v";
    input.cards.forEach((card, i) => {
      const s = (card.start_ms / 1000).toFixed(3);
      const e = (card.end_ms / 1000).toFixed(3);
      const out = i === input.cards.length - 1 ? "vout" : `v${i}`;
      filter += `[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${s},${e})'[${out}];`;
      last = out;
    });
    filter = filter.replace(/;$/, "");

    await ffmpeg([
      ...inputs,
      "-filter_complex", filter,
      "-map", "[vout]", "-map", "0:a?",
      ...X264, "-c:a", "copy",
      input.outFile,
    ]);
    await input.onProgress?.(100, "เสร็จแล้ว");
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
