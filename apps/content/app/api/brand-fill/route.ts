import { NextRequest, NextResponse } from "next/server";
import { brandFill } from "@cs/prompts";
import { run, AiError } from "@cs/ai";

export const maxDuration = 60;

// §BV "ให้ AI กรอกให้" — extract a structured brand profile from a free-text story.
// Returns the profile for the user to review/edit (step 2 of the wizard); saving
// happens via a separate call once they confirm.
export async function POST(req: NextRequest) {
  try {
    const { free_text_story } = (await req.json()) as { free_text_story: string };
    if (!free_text_story?.trim()) {
      return NextResponse.json({ error: "เล่าเรื่องธุรกิจของคุณสักหน่อย" }, { status: 400 });
    }
    const result = await run(brandFill, { free_text_story });
    return NextResponse.json({ brand: result.output });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
