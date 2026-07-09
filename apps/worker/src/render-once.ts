// Standalone verify: render a base.mp4 from a script, no DB/worker involved.
// Run: set -a && source ../../.env && set +a && pnpm --filter @cs/worker render:once
import path from "node:path";
import os from "node:os";
import { renderPreview } from "./render/pipeline";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error("GEMINI_API_KEY missing"); process.exit(1); }

const script = `วันนี้จะมาเล่าเรื่อง AI ที่ช่วยธุรกิจไทยได้จริง
เริ่มจากการสร้างคอนเทนต์อัตโนมัติ ประหยัดเวลาได้เยอะ
ลองเอาไปใช้กันดูนะครับ`;

const workDir = path.join(os.tmpdir(), "cs-render-verify");
const outFile = path.join(os.tmpdir(), "cs-base-verify.mp4");

const t0 = Date.now();
const result = await renderPreview({
  script,
  voice: "Aoede",
  brollTier: "ai",
  apiKey,
  outFile,
  workDir,
  onProgress: (p, l) => console.log(`  [${String(p).padStart(3)}%] ${l}`),
});

console.log(`\n✓ rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("  base.mp4:", result.basePath);
console.log("  duration:", result.durationSec.toFixed(2), "s");
console.log("  segments:", result.segments.length);
console.log("  caption cards:");
for (const c of result.captions) {
  console.log(`    [${(c.start_ms / 1000).toFixed(1)}-${(c.end_ms / 1000).toFixed(1)}s] ${c.type === "hook" ? "HOOK " : ""}${c.text}`);
}
