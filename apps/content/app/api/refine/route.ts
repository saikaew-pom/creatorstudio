import { NextRequest, NextResponse } from "next/server";
import { refine, ContentKitSchema, type ContentKit } from "@cs/prompts";
import { run, enforceSectionLock, AiError } from "@cs/ai";

export const maxDuration = 60;

const SECTION_KEYS: (keyof ContentKit)[] = ["hooks", "scripts", "visual", "hashtags"];
const SECTION_MAP: Record<string, keyof ContentKit> = {
  hook: "hooks",
  script: "scripts",
  visual: "visual",
  hashtags: "hashtags",
};

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
    const locked = enforceSectionLock(
      previous as unknown as Record<string, unknown>,
      result.output as unknown as Record<string, unknown>,
      section ? (SECTION_MAP[section] as string) : undefined,
      SECTION_KEYS as string[]
    );
    return NextResponse.json({ kit: locked });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "ปรับไม่สำเร็จ ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
