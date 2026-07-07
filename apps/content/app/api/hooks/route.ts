import { NextRequest, NextResponse } from "next/server";
import { hookVariants } from "@cs/prompts";
import { run, AiError } from "@cs/ai";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await run(hookVariants, body);
    return NextResponse.json({ hooks: result.output.hooks });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
