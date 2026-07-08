import { NextRequest, NextResponse } from "next/server";
import { contentKit, type ContentKitInput } from "@cs/prompts";
import { run, AiError } from "@cs/ai";
import { insertGeneration, getBrand, getStyle } from "@cs/db";
import { gateGeneration, gateError } from "../../../lib/gate";

export const maxDuration = 60;

interface GenerateBody extends Omit<ContentKitInput, "brand" | "style"> {
  brandId?: string;
  styleId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    if (!body.topic?.trim() || !body.platforms?.length) {
      return NextResponse.json({ error: "กรอกหัวข้อและเลือกแพลตฟอร์มก่อน" }, { status: 400 });
    }

    // Auth + daily-quota gate (no-op in unconfigured/dev mode).
    const gate = await gateGeneration("content_studio");
    const gateErr = gateError(gate);
    if (gateErr) return NextResponse.json(gateErr.body, { status: gateErr.status });

    // Load brand/style server-side by id (RLS scopes them to the owner) — the client
    // sends only ids, never the profile objects, so they can't be tampered with.
    const input: ContentKitInput = {
      topic: body.topic,
      niche: body.niche,
      platforms: body.platforms,
      template: body.template,
      goal: body.goal,
    };
    if (gate.kind === "ok") {
      if (body.brandId) {
        const brand = await getBrand(gate.db, body.brandId);
        if (brand) input.brand = brand.data;
      }
      if (body.styleId) {
        const style = await getStyle(gate.db, body.styleId);
        if (style) input.style = style.profile;
      }
    }

    const result = await run(contentKit, input);

    // Persist for /history, reopen-via-?jobId, and Inspiration remix (only when signed in).
    let generationId: string | undefined;
    if (gate.kind === "ok") {
      try {
        const gen = await insertGeneration(gate.db, {
          user_id: gate.userId,
          type: "content_kit",
          tool: "content_studio",
          title: result.output.topic_refined,
          input,
          output: result.output,
          prompt_id: result.prompt_id,
          model: result.model,
          niche: input.niche,
          platform: input.platforms,
        });
        generationId = gen.id;
      } catch {
        // Persistence failure shouldn't lose the user's generated content — return it anyway.
      }
    }

    return NextResponse.json({
      kit: result.output,
      generationId,
      remaining: gate.kind === "ok" ? gate.remaining : undefined,
      meta: { prompt_id: result.prompt_id, model: result.model, latency_ms: result.latency_ms },
    });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
