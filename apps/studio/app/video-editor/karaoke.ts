// Client-side caption re-splitting for the "karaoke" length modes (1 ประโยค → 1 คำ).
// We already know each sentence card's exact [start_ms,end_ms] (from per-segment TTS
// durations), so word-level timing is obtained by splitting the sentence into words
// (Thai has no spaces — use Intl.Segmenter word boundaries) and distributing the card's
// duration across the chunks proportionally to their character length. No Whisper, no
// re-render: switching modes just re-derives the cards the preview + export consume.
import type { CaptionCard } from "@cs/captions";

export type LengthMode = "sentence" | 4 | 3 | 2 | 1;

export const LENGTH_MODES: { value: LengthMode; label: string }[] = [
  { value: "sentence", label: "1 ประโยค" },
  { value: 4, label: "≤4 คำ" },
  { value: 3, label: "≤3 คำ" },
  { value: 2, label: "≤2 คำ" },
  { value: 1, label: "1 คำ" },
];

interface Token { text: string; start: number; end: number } // char offsets in the source

/** Tokenize into word-like units, preserving each unit's char span so we can rebuild
 * text (including in-between punctuation attached to the preceding word). */
function words(text: string): Token[] {
  const SegAny = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!SegAny) {
    // Fallback: whitespace split (fine for latin; Thai keeps whole sentence).
    const out: Token[] = [];
    let i = 0;
    for (const w of text.split(/(\s+)/)) {
      if (w.trim()) out.push({ text: w, start: i, end: i + w.length });
      i += w.length;
    }
    return out.length ? out : [{ text, start: 0, end: text.length }];
  }
  const seg = new SegAny("th", { granularity: "word" });
  const out: Token[] = [];
  for (const s of seg.segment(text) as Iterable<{ segment: string; index: number; isWordLike?: boolean }>) {
    if (s.isWordLike) out.push({ text: s.segment, start: s.index, end: s.index + s.segment.length });
  }
  return out.length ? out : [{ text, start: 0, end: text.length }];
}

/** Re-split sentence-level cards into <=maxWords-per-card chunks with proportional timing. */
export function resplitCards(base: CaptionCard[], mode: LengthMode): CaptionCard[] {
  if (mode === "sentence") return base.map((c, i) => ({ ...c, idx: i }));
  const maxWords = mode;
  const out: CaptionCard[] = [];
  let idx = 0;

  for (const card of base) {
    const toks = words(card.text);
    // Group tokens into chunks of up to maxWords.
    const chunks: Token[][] = [];
    for (let i = 0; i < toks.length; i += maxWords) chunks.push(toks.slice(i, i + maxWords));

    const dur = card.end_ms - card.start_ms;
    const totalChars = chunks.reduce((n, ch) => n + ch.reduce((m, t) => m + (t.end - t.start), 0), 0) || 1;
    let cursor = card.start_ms;

    chunks.forEach((ch, ci) => {
      // Text spans from the first token's start to the last token's end (keeps punctuation).
      const text = card.text.slice(ch[0].start, ch[ch.length - 1].end).trim();
      const chars = ch.reduce((m, t) => m + (t.end - t.start), 0);
      const slice = Math.round((chars / totalChars) * dur);
      const start = cursor;
      const end = ci === chunks.length - 1 ? card.end_ms : Math.min(card.end_ms, cursor + slice);
      cursor = end;
      if (text) out.push({ idx: idx++, start_ms: start, end_ms: end, text, type: card.type });
    });
  }
  return out;
}
