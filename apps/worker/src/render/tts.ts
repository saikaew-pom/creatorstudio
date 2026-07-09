// Per-segment TTS via Gemini (verified live: gemini-2.5-flash-preview-tts returns
// L16/24kHz PCM for Thai). Per-segment generation gives exact per-segment durations
// "for free" (doc 04 §2) — which is what lets us time caption cards at the segment
// level without Whisper. Each segment's PCM is written to WAV; durations returned.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ffprobeDuration, ffmpeg } from "./ffmpeg";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const PCM_RATE = 24000; // L16 mono per the returned mimeType

export interface TtsSegment {
  index: number;
  wavPath: string;
  duration: number; // seconds
}

async function synthOne(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
  };
  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("TTS returned no audio");
  return Buffer.from(b64, "base64");
}

/** Synthesize each segment to a normalized WAV; returns per-segment durations. */
export async function synthesizeSegments(
  segments: { index: number; text: string }[],
  voice: string,
  outDir: string,
  apiKey: string
): Promise<TtsSegment[]> {
  const results: TtsSegment[] = [];
  for (const seg of segments) {
    const pcm = await synthOne(seg.text, voice, apiKey);
    const pcmPath = path.join(outDir, `seg_${seg.index}.pcm`);
    const wavPath = path.join(outDir, `seg_${seg.index}.wav`);
    writeFileSync(pcmPath, pcm);
    // PCM → WAV, loudness-normalized toward -16 LUFS (doc 04 §2).
    await ffmpeg([
      "-f", "s16le", "-ar", String(PCM_RATE), "-ac", "1", "-i", pcmPath,
      "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", wavPath,
    ]);
    results.push({ index: seg.index, wavPath, duration: await ffprobeDuration(wavPath) });
  }
  return results;
}

/** Gemini prebuilt voices exposed in the studio UI (doc 01 §B2). */
export const GEMINI_VOICES = [
  { id: "Aoede", name: "Aoede", desc: "Female · Breezy" },
  { id: "Puck", name: "Puck", desc: "Male · Upbeat" },
  { id: "Kore", name: "Kore", desc: "Female · Firm" },
  { id: "Charon", name: "Charon", desc: "Male · Deep" },
];
