import { NextRequest, NextResponse } from "next/server";
import { brainstorm } from "@cs/prompts";
import { run, AiError } from "@cs/ai";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { topic_or_niche, platforms } = await req.json();
    if (!topic_or_niche?.trim())
      return NextResponse.json({ error: "พิมพ์หัวข้อหรือ niche สักหน่อย" }, { status: 400 });
    const result = await run(brainstorm, { topic_or_niche, platforms });
    return NextResponse.json({ ideas: result.output.ideas });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
