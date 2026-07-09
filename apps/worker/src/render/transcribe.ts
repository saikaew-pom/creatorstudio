// Transcribe an uploaded clip's audio → Thai caption segments (doc 04 §7). Extracts
// audio with ffmpeg, sends it to Gemini for transcription-with-timing. Verified live:
// Gemini splits Thai speech into accurate sentence segments; timing is rough (rounded
// to ~seconds), so we scale the segments to fit the true audio duration.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ffmpeg, ffprobeDuration } from "./ffmpeg";

interface RawSeg { start: number; end: number; text: string }

export interface TranscribedSegment {
  index: number;
  text: string;
  start: number;
  end: number;
}

export async function transcribeClip(
  videoPath: string,
  workDir: string,
  apiKey: string
): Promise<TranscribedSegment[]> {
  // Extract mono 16k wav (small; good for STT).
  const wavPath = path.join(workDir, "audio.wav");
  await ffmpeg(["-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", wavPath]);
  const duration = await ffprobeDuration(wavPath);
  const audioB64 = readFileSync(wavPath).toString("base64");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [
      { text: "ถอดเสียงคลิปนี้เป็นข้อความไทย แบ่งเป็นช่วงประโยคสั้นๆ (เหมาะทำซับ) พร้อมเวลาเริ่ม-จบเป็นวินาที (ทศนิยม) เรียงตามเวลา ตอบ JSON เท่านั้น" },
      { inlineData: { mimeType: "audio/wav", data: audioB64 } },
    ] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { segments: { type: "array", items: {
          type: "object",
          properties: { start: { type: "number" }, end: { type: "number" }, text: { type: "string" } },
          required: ["start", "end", "text"],
        } } },
        required: ["segments"],
      },
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(raw) as { segments?: RawSeg[] };
  let segs = (parsed.segments ?? []).filter((s) => s.text?.trim());
  if (segs.length === 0) throw new Error("ถอดเสียงไม่ได้ — คลิปอาจไม่มีเสียงพูด");

  // Gemini timing is approximate; scale so the last segment ends at the true duration,
  // and clamp/monotonic-fix so cards never overlap or exceed the clip.
  const lastEnd = segs[segs.length - 1].end || duration;
  const scale = lastEnd > 0 ? duration / lastEnd : 1;
  let prevEnd = 0;
  return segs.map((s, i) => {
    const start = Math.max(prevEnd, s.start * scale);
    const end = Math.min(duration, Math.max(start + 0.4, s.end * scale));
    prevEnd = end;
    return { index: i, text: s.text.trim(), start, end };
  });
}
