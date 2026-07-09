// Per-segment TTS. Prefers MiniMax (speech-02-turbo via api.minimax.io) when
// MINIMAX_API_KEY is set, else falls back to Gemini. Per-segment generation gives
// exact per-segment durations "for free" (doc 04 §2) — what lets us time caption cards
// at the segment level without Whisper. Each segment is normalized to -16 LUFS WAV.
//
// Why MiniMax is the default: verified live it produces cleaner Thai speech AND handles
// short imperatives ("ลองใช้วันนี้") that Gemini's TTS deterministically refuses.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ffprobeDuration, ffmpeg } from "./ffmpeg";

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_PCM_RATE = 24000; // L16 mono per the returned mimeType
const MINIMAX_URL = "https://api.minimax.io/v1/t2a_v2";
const MINIMAX_MODEL = "speech-02-turbo";

export interface TtsSegment {
  index: number;
  wavPath: string;
  duration: number; // seconds
}

// UI voice ids (doc 01 §B2) map to a MiniMax system voice when MiniMax is the provider.
export const GEMINI_VOICES = [
  { id: "Aoede", name: "Aoede", desc: "Female · Breezy" },
  { id: "Puck", name: "Puck", desc: "Male · Upbeat" },
  { id: "Kore", name: "Kore", desc: "Female · Firm" },
  { id: "Charon", name: "Charon", desc: "Male · Deep" },
];
const MINIMAX_VOICE: Record<string, string> = {
  Aoede: "Lively_Girl",
  Puck: "Casual_Guy",
  Kore: "Wise_Woman",
  Charon: "Deep_Voice_Man",
};

// ---------- Gemini (fallback) ----------
async function geminiOnce(text: string, voice: string, apiKey: string): Promise<{ bytes: Buffer; raw: "pcm" }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("TTS returned no audio");
  return { bytes: Buffer.from(b64, "base64"), raw: "pcm" };
}

async function geminiSynth(text: string, voice: string, apiKey: string): Promise<{ bytes: Buffer; raw: "pcm" }> {
  // Gemini TTS deterministically refuses short imperatives ("...should only be used for
  // TTS"). Quoting the line makes it clearly text-to-read (quotes aren't spoken).
  try {
    return await geminiOnce(text, voice, apiKey);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("should only be used for TTS")) throw e;
    return await geminiOnce(`"${text.replace(/"/g, "")}"`, voice, apiKey);
  }
}

// ---------- MiniMax (preferred) ----------
async function minimaxSynth(text: string, uiVoice: string, apiKey: string): Promise<{ bytes: Buffer; raw: "mp3" }> {
  const res = await fetch(MINIMAX_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      text,
      stream: false,
      voice_setting: { voice_id: MINIMAX_VOICE[uiVoice] ?? "Wise_Woman", speed: 1 },
      audio_setting: { format: "mp3", sample_rate: 24000 },
    }),
  });
  const json = (await res.json()) as { base_resp?: { status_code: number; status_msg: string }; data?: { audio: string } };
  if (json.base_resp?.status_code !== 0 || !json.data?.audio) {
    throw new Error(`MiniMax TTS: ${json.base_resp?.status_msg ?? "no audio"}`);
  }
  // MiniMax returns hex-encoded audio.
  return { bytes: Buffer.from(json.data.audio, "hex"), raw: "mp3" };
}

/** Synthesize each segment to a normalized WAV; returns per-segment durations. */
export async function synthesizeSegments(
  segments: { index: number; text: string }[],
  voice: string,
  outDir: string,
  geminiKey: string
): Promise<TtsSegment[]> {
  const minimaxKey = process.env.MINIMAX_API_KEY;
  const results: TtsSegment[] = [];
  for (const seg of segments) {
    const out = minimaxKey
      ? await minimaxSynth(seg.text, voice, minimaxKey)
      : await geminiSynth(seg.text, voice, geminiKey);

    const rawPath = path.join(outDir, `seg_${seg.index}.${out.raw}`);
    const wavPath = path.join(outDir, `seg_${seg.index}.wav`);
    writeFileSync(rawPath, out.bytes);
    // Normalize to -16 LUFS WAV (doc 04 §2). MiniMax mp3 is decoded here; Gemini PCM
    // needs its raw format flags. MiniMax audio runs quiet, so loudnorm matters.
    const input = out.raw === "pcm"
      ? ["-f", "s16le", "-ar", String(GEMINI_PCM_RATE), "-ac", "1", "-i", rawPath]
      : ["-i", rawPath];
    await ffmpeg([...input, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", wavPath]);
    results.push({ index: seg.index, wavPath, duration: await ffprobeDuration(wavPath) });
  }
  return results;
}
