import { NextRequest, NextResponse } from "next/server";
import { contentKit, type ContentKitInput } from "@cs/prompts";
import { run, AiError } from "@cs/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as ContentKitInput;
    if (!input.topic?.trim() || !input.platforms?.length) {
      return NextResponse.json({ error: "กรอกหัวข้อและเลือกแพลตฟอร์มก่อน" }, { status: 400 });
    }
    // TODO(M1): daily-quota RPC + persist to `generations` (Supabase)
    const result = await run(contentKit, input);
    return NextResponse.json({
      kit: result.output,
      meta: { prompt_id: result.prompt_id, model: result.model, latency_ms: result.latency_ms },
    });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
