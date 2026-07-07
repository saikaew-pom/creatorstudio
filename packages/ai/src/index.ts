// Provider router (BLUEPRINT §2, doc 02 §0.1): Gemini REST, JSON mode, retry + schema repair.
import { z } from "zod";
import type { ModelTier, PromptModule } from "@cs/prompts";

const MODEL_MAP: Record<Extract<ModelTier, "fast" | "smart">, string> = {
  fast: "gemini-2.5-flash",
  smart: "gemini-2.5-pro",
};

export interface RunOptions {
  apiKey?: string; // BYO key override; falls back to process.env.GEMINI_API_KEY
  modelOverride?: string;
  signal?: AbortSignal;
}

export interface RunResult<O> {
  output: O;
  raw: string;
  model: string;
  latency_ms: number;
  prompt_id: string;
  repaired: boolean;
}

export class AiError extends Error {
  constructor(
    message: string,
    public code: "provider" | "schema" | "auth" | "quota",
    public detail?: unknown
  ) {
    super(message);
  }
}

async function callGemini(
  model: string,
  system: string,
  user: string,
  temperature: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 429)
        throw new AiError("โควต้าโมเดลเต็มชั่วคราว ลองใหม่อีกครั้ง", "quota");
      if (res.status === 401 || res.status === 403)
        throw new AiError("API key ไม่ถูกต้อง", "auth");
      if (!res.ok) {
        lastErr = new AiError(`provider ${res.status}`, "provider", await res.text());
        continue; // retry 5xx once
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      if (!text) throw new AiError("empty response", "provider", json);
      return text;
    } catch (e) {
      if (e instanceof AiError && e.code !== "provider") throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof AiError
    ? lastErr
    : new AiError("เรียกโมเดลไม่สำเร็จ", "provider", lastErr);
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/** Run a prompt module: call → parse → validate → (1 repair round) → validated output. */
export async function run<I, O>(
  mod: PromptModule<I, O>,
  input: I,
  opts: RunOptions = {}
): Promise<RunResult<O>> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY", "auth");
  const model =
    opts.modelOverride ??
    MODEL_MAP[(mod.model === "smart" ? "smart" : "fast") as "fast" | "smart"];
  const system = mod.system(input);
  const user = mod.user(input);
  const t0 = Date.now();

  let raw = await callGemini(model, system, user, mod.temperature, apiKey, opts.signal);
  let repaired = false;

  for (let round = 0; round < 2; round++) {
    try {
      const parsed = JSON.parse(extractJson(raw));
      const result = mod.schema.safeParse(parsed);
      if (result.success) {
        return {
          output: result.data,
          raw,
          model,
          latency_ms: Date.now() - t0,
          prompt_id: mod.id,
          repaired,
        };
      }
      if (round === 1) throw new AiError("ผลลัพธ์ไม่ตรง schema", "schema", result.error);
      raw = await callGemini(
        model,
        `You return ONLY corrected JSON. Fix the JSON to satisfy the requirements. Do not change content unnecessarily.`,
        `The JSON below failed validation with these errors:\n${JSON.stringify(
          result.error.issues.slice(0, 10)
        )}\n\nJSON:\n${raw}\n\nReturn the corrected JSON only.`,
        0.1,
        apiKey,
        opts.signal
      );
      repaired = true;
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (round === 1) throw new AiError("อ่านผลลัพธ์ JSON ไม่ได้", "schema", e);
      raw = await callGemini(
        model,
        `You return ONLY valid JSON. Repair the malformed JSON. Preserve all content.`,
        `Malformed JSON:\n${raw}\n\nReturn valid JSON only.`,
        0.1,
        apiKey,
        opts.signal
      );
      repaired = true;
    }
  }
  throw new AiError("unreachable", "schema");
}

/** Refine post-check (doc 02 §R.1): restore untouched sections byte-identically. */
export function enforceSectionLock<T extends Record<string, unknown>>(
  previous: T,
  next: T,
  targetSection: keyof T | undefined,
  sectionKeys: (keyof T)[]
): T {
  if (!targetSection) return next; // refine-all: model decides scope
  const out = { ...next };
  for (const key of sectionKeys) {
    if (key !== targetSection) out[key] = previous[key];
  }
  return out;
}
