// Verify the caption burn: render a base.mp4, then burn captions with a chosen theme,
// and (separately) render each theme's HOOK card to a PNG grid for the "11 distinct
// themes" check. Run: set -a && source ../../.env && set +a && pnpm --filter @cs/worker exec tsx src/export-once.ts
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { cardToSvg, DEFAULT_STYLE, THEMES, type CaptionCard } from "@cs/captions";
import { renderPreview } from "./render/pipeline";
import { burnCaptions } from "./render/export";

// Same bundled Thai fonts as render/export.ts (this file lives one level up).
const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fonts");

const apiKey = process.env.GEMINI_API_KEY!;
const tmp = os.tmpdir();

// 1. Base video (short).
const script = `AI ช่วยร้านค้าไทยขายดีขึ้นแบบไม่ต้องจ้างทีมใหญ่
ลองใช้ดูวันนี้เลยนะครับ`;
const basePath = path.join(tmp, "cs-export-base.mp4");
console.log("rendering base…");
const base = await renderPreview({ script, voice: "Puck", brollTier: "ai", apiKey, outFile: basePath, workDir: path.join(tmp, "cs-export-work") });
console.log("  base:", base.durationSec.toFixed(1) + "s,", base.captions.length, "cards");

// 2. Burn captions (hormozi theme).
const finalPath = path.join(tmp, "cs-export-final.mp4");
await burnCaptions({
  basePath, cards: base.captions as CaptionCard[], style: DEFAULT_STYLE, outFile: finalPath,
  onProgress: (p, l) => console.log(`  [${p}%] ${l}`),
});
console.log("  final:", finalPath);

// 3. Theme grid: render the HOOK card in every theme → one PNG per theme, tiled.
const hook: CaptionCard = { idx: 0, start_ms: 0, end_ms: 3000, text: "ลด 50% วันนี้เท่านั้น", type: "hook" };
const keys = Object.keys(THEMES) as (keyof typeof THEMES)[];
for (const k of keys) {
  const svg = cardToSvg({ ...DEFAULT_STYLE, theme: k, pos_vertical_pct: 50 }, hook, 1080, 400);
  const png = new Resvg(svg, { background: "rgba(20,20,30,1)", font: { fontDirs: [FONTS_DIR], loadSystemFonts: false, defaultFontFamily: "Sarabun" } }).render().asPng();
  writeFileSync(path.join(tmp, `theme-${k}.png`), png);
}
console.log("theme PNGs written for:", keys.join(", "));
