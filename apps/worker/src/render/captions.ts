// Segment-level caption cards. Each script segment = one card, timed to that
// segment's TTS audio duration (cumulative offsets). This needs no Whisper: per-segment
// TTS already gives exact per-segment timing (doc 04 §2). Word-level karaoke WITHIN a
// segment (chunk_mode w2/w3/w4) is the M6/Whisper upgrade; segment cards are the honest
// MVP and match the "1 ประโยค" default chunk mode.
export interface CaptionCard {
  idx: number;
  start_ms: number;
  end_ms: number;
  text: string;
  type: "hook" | "normal";
}

export function buildSegmentCaptions(
  segments: { index: number; text: string; type: "hook" | "body"; duration: number }[]
): CaptionCard[] {
  const cards: CaptionCard[] = [];
  let t = 0;
  for (const seg of segments) {
    const start = Math.round(t * 1000);
    const end = Math.round((t + seg.duration) * 1000);
    cards.push({
      idx: seg.index,
      start_ms: start,
      end_ms: end,
      text: seg.text,
      type: seg.type === "hook" ? "hook" : "normal",
    });
    t += seg.duration;
  }
  return cards;
}
