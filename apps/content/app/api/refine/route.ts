import { NextRequest, NextResponse } from "next/server";
import { refine, ContentKitSchema, applyContentKitPatch, type ContentKit } from "@cs/prompts";
import { run, AiError } from "@cs/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { kit, instruction, section } = (await req.json()) as {
      kit: ContentKit;
      instruction: string;
      section?: "hook" | "script" | "visual" | "hashtags";
    };
    const previous = ContentKitSchema.parse(kit);
    const result = await run(
      refine,
      {
        current_kit_json: JSON.stringify(previous),
        instruction,
        section_name: section,
      },
      // refine-all routes to the smart tier (doc 02 §R.2)
      section ? {} : { modelOverride: "gemini-2.5-pro" }
    );
    // Patch-based merge (doc 02 §R v2): untouched sections are guaranteed
    // unchanged because the model never returns them, not because it echoed
    // them correctly — see content-kit.ts for why v1's echo-back approach
    // was replaced after live testing found it corrupted an untouched section.
    const merged = applyContentKitPatch(previous, result.output, section);
    return NextResponse.json({ kit: merged });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "ปรับไม่สำเร็จ ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
