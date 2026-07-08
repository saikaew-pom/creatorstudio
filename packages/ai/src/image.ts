// Image generation (doc 02 §I). Two tiers, verified live against the real API
// (2026-07-09) rather than guessed model IDs — see docs/02-prompt-engine.md §I
// for the evidence: gemini-2.5-flash-image reliably gets short Thai headline
// text right but sometimes hallucinates an extra garbled line ("standard" —
// unreliable non-Latin text); gemini-3.1-flash-image renders Thai text
// naturally and correctly (signage, aprons, headlines) at lower latency than
// gemini-3-pro-image ("pro" — 5 credits). Both support imageConfig.aspectRatio
// for 1:1 / 4:5 / 9:16 / 16:9 / 2:3, confirmed by checking actual output pixel
// dimensions, not just a 200 response.
import { AiError } from "./errors";

export const IMAGE_MODEL_MAP = {
  "image-standard": "gemini-2.5-flash-image",
  "image-pro": "gemini-3.1-flash-image",
} as const;
export type ImageTier = keyof typeof IMAGE_MODEL_MAP;
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "2:3";

export interface ReferenceImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface GenerateImageInput {
  prompt: string; // English, already enhanced (doc 02 §I.1 step 1)
  tier: ImageTier;
  aspectRatio: AspectRatio;
  referenceImages?: ReferenceImage[];
  apiKey?: string;
}

export interface GenerateImageResult {
  mimeType: string;
  data: Buffer;
  model: string;
  latency_ms: number;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const apiKey = input.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY", "auth");
  const model = IMAGE_MODEL_MAP[input.tier];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Record<string, unknown>[] = [{ text: input.prompt }];
  for (const ref of input.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: input.aspectRatio },
    },
  };

  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new AiError("โควต้าโมเดลเต็มชั่วคราว ลองใหม่อีกครั้ง", "quota");
  if (res.status === 401 || res.status === 403) throw new AiError("API key ไม่ถูกต้อง", "auth");
  if (!res.ok) {
    const detail = await res.text();
    throw new AiError("สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง", "provider", detail);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  };
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline) throw new AiError("โมเดลไม่ได้สร้างภาพกลับมา ลองใหม่อีกครั้ง", "provider", json);

  return {
    mimeType: inline.mimeType,
    data: Buffer.from(inline.data, "base64"),
    model,
    latency_ms: Date.now() - t0,
  };
}
