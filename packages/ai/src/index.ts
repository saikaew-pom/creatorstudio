// Provider router (BLUEPRINT §2, doc 02 §0.1): Gemini REST, JSON mode, retry + schema repair.
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
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

/**
 * Gemini's `responseSchema` accepts only a restricted OpenAPI-3 subset:
 * type/format/description/nullable/enum/items/properties/required/propertyOrdering/
 * minItems/maxItems. Strip everything else (JSON-Schema-only keywords like
 * additionalProperties, $schema, $ref, definitions) that zod-to-json-schema emits.
 */
function toGeminiSchema(schema: z.ZodType, opts: { requireAllTopLevel?: boolean } = {}): unknown {
  const requireAllTopLevel = opts.requireAllTopLevel ?? true;
  const json = zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none" });
  const ALLOWED = new Set([
    "type", "format", "description", "nullable", "enum", "items", "properties",
    "required", "propertyOrdering", "minItems", "maxItems", "minLength", "maxLength",
    "minimum", "maximum",
  ]);
  // NB: `properties` and `required`/`enum` hold data (property names / literal values),
  // not nested schema nodes to filter by ALLOWED — they need dedicated handling below,
  // everything else is either a primitive or a nested schema node to recurse into.
  function sanitize(node: unknown, isRoot: boolean): unknown {
    if (!node || typeof node !== "object") return node;
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (!ALLOWED.has(k)) continue;
      if (k === "properties") {
        const props: Record<string, unknown> = {};
        for (const [propName, propSchema] of Object.entries(v as Record<string, unknown>)) {
          props[propName] = sanitize(propSchema, false);
        }
        out.properties = props;
      } else if (k === "items") {
        out.items = sanitize(v, false);
      } else if (k === "required" || k === "enum") {
        out[k] = v; // arrays of primitive strings — leave as-is
      } else {
        out[k] = v; // primitives: type, format, description, nullable, min/maxItems, etc.
      }
    }
    // Gemini requires `required` to be present when properties exist for reliable
    // output — BUT only default to "all keys required" when that's actually true.
    // zod-to-json-schema omits `required` entirely (rather than emitting `[]`) for
    // a fully-.partial() object, which would otherwise silently make us tell Gemini
    // every key is mandatory — exactly backwards for a patch-shaped root schema
    // (this previously caused refine's patch schema to always return all 4 keys).
    if (out.properties && out.required === undefined && (!isRoot || requireAllTopLevel)) {
      out.required = Object.keys(out.properties as Record<string, unknown>);
    }
    return out;
  }
  return sanitize(json, true);
}

async function callGemini(
  model: string,
  system: string,
  user: string,
  temperature: number,
  apiKey: string,
  opts: { schema?: unknown; thinkingBudget?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    temperature,
    responseMimeType: "application/json",
    maxOutputTokens: 16384,
  };
  if (opts.schema) generationConfig.responseSchema = opts.schema;
  if (opts.thinkingBudget !== undefined)
    generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig,
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal,
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
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: string;
        }[];
      };
      const candidate = json.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text).join("") ?? "";
      if (!text) {
        if (candidate?.finishReason === "MAX_TOKENS")
          throw new AiError("คำตอบยาวเกินขีดจำกัด ลองย่อคำสั่งลง", "provider", json);
        throw new AiError("empty response", "provider", json);
      }
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
  const tier = opts.modelOverride ? undefined : mod.model === "smart" ? "smart" : "fast";
  const model = opts.modelOverride ?? MODEL_MAP[tier as "fast" | "smart"];
  const system = mod.system(input);
  const user = mod.user(input);
  const t0 = Date.now();
  const geminiSchema = toGeminiSchema(mod.schema as unknown as z.ZodType, {
    requireAllTopLevel: !mod.partialTopLevel,
  });
  // Structured extraction doesn't need deep reasoning; skip "thinking" on the fast
  // tier for latency/cost, keep default (auto) reasoning on the smart tier for refine.
  const thinkingBudget = tier === "fast" ? 0 : undefined;

  let raw = await callGemini(model, system, user, mod.temperature, apiKey, {
    schema: geminiSchema,
    thinkingBudget,
    signal: opts.signal,
  });
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
        { schema: geminiSchema, thinkingBudget: 0, signal: opts.signal }
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
        { schema: geminiSchema, thinkingBudget: 0, signal: opts.signal }
      );
      repaired = true;
    }
  }
  throw new AiError("unreachable", "schema");
}

