// §VD Video studio prompts (doc 02 §VD)
import { z } from "zod";
import { PromptModule } from "./shared";

// ---------- VD.1 B-roll keywords ----------
export interface BrollKeywordsInput {
  project_title: string;
  segments: { type: "hook" | "body"; text: string }[];
}

export const BrollKeywordsSchema = z.object({
  segments: z.array(
    z.object({
      index: z.number(),
      keyword_primary: z.string(),
      keyword_alts: z.array(z.string()).length(2),
      vibe: z.enum([
        "talking-head",
        "screen-ui",
        "lifestyle",
        "product",
        "nature",
        "city",
        "abstract-tech",
      ]),
    })
  ),
});
export type BrollKeywords = z.infer<typeof BrollKeywordsSchema>;

export const brollKeywords: PromptModule<BrollKeywordsInput, BrollKeywords> = {
  id: "video.broll.v1",
  model: "fast",
  temperature: 0.4,
  schema: BrollKeywordsSchema,
  system: () => `You are a stock-footage researcher. For each Thai script segment, produce English search keywords that will find matching B-roll on Pexels/Pixabay.
Rules:
- 2-4 words per keyword, concrete and VISUAL (things a camera can film), never abstract ("success" is wrong; "businessman celebrating office" is right)
- Thai cultural context when the script implies it ("street food bangkok", "thai woman laptop cafe")
- keyword_primary = the best query; keyword_alts = 2 fallbacks used if primary returns < 3 results (vertical filter on)
- vibe: one of [talking-head, screen-ui, lifestyle, product, nature, city, abstract-tech] — used to bias selection variety so adjacent segments don't look identical
Respond JSON only.`,
  user: (i) =>
    `Video topic: ${i.project_title}\nSegments (Thai):\n${i.segments
      .map((s, n) => `${n + 1}. [${s.type}] ${s.text}`)
      .join("\n")}`,
};

// ---------- VD.2 Script polish ----------
export interface ScriptPolishInput {
  lines: string[];
}
export const ScriptPolishSchema = z.object({ lines: z.array(z.string()) });

export const scriptPolish: PromptModule<
  ScriptPolishInput,
  z.infer<typeof ScriptPolishSchema>
> = {
  id: "video.polish.v1",
  model: "fast",
  temperature: 0.6,
  schema: ScriptPolishSchema,
  system: () => `คุณคือคนเขียนสคริปต์วิดีโอสั้น เกลาสคริปต์ให้พูดลื่น เป็นภาษาพูด ตัดคำฟุ่มเฟือย บรรทัดแรกต้องเป็น hook ≤ 2 วินาที รักษาจำนวนบรรทัด = จำนวนเซ็กเมนต์เดิม (1 บรรทัด = 1 เซ็กเมนต์) ห้ามเพิ่มเนื้อหาใหม่
ตอบ JSON เท่านั้น: { "lines": [...] }`,
  user: (i) => i.lines.join("\n"),
};

// ---------- Segment splitting (pure code, no AI — doc 01 §B2) ----------
export interface Segment {
  idx: number;
  type: "hook" | "body";
  text: string;
  est_start: number; // seconds
  est_end: number;
}

/** Thai speech baseline ~2.5 words/sec (tune later). Words ≈ whitespace/token count. */
export function splitScript(script: string, wordsPerSec = 2.5): Segment[] {
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let t = 0;
  return lines.map((text, idx) => {
    const words = countThaiWords(text);
    const dur = Math.max(1, words / wordsPerSec);
    const seg: Segment = {
      idx,
      type: idx === 0 ? "hook" : "body",
      text,
      est_start: t,
      est_end: t + dur,
    };
    t += dur;
    return seg;
  });
}

export function countThaiWords(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    let n = 0;
    for (const s of seg.segment(text)) if (s.isWordLike) n++;
    return n;
  }
  // fallback: whitespace tokens + rough Thai char clusters
  return Math.max(1, Math.round(text.replace(/\s+/g, " ").length / 6));
}
