import { NextRequest, NextResponse } from "next/server";
import { buildViralKitPrompt, viralKit, type TemplateRecord } from "@cs/prompts";
import { run, AiError } from "@cs/ai";
import { getTemplate, incrementTemplateUsage, insertGeneration } from "@cs/db";
import { gateGeneration, gateError } from "../../../lib/gate";

export const maxDuration = 60;

// Viral Studio: render the chosen template's master_prompt from the user's form
// values (server-side, from the DB template — never trust a client-sent prompt),
// generate the kit, persist, and bump usage_count on success only.
export async function POST(req: NextRequest) {
  try {
    const { slug, formValues } = (await req.json()) as {
      slug: string;
      formValues: Record<string, string>;
    };
    if (!slug) return NextResponse.json({ error: "ไม่พบเทมเพลต" }, { status: 400 });

    const gate = await gateGeneration("viral_studio");
    const gateErr = gateError(gate);
    if (gateErr) return NextResponse.json(gateErr.body, { status: gateErr.status });

    // Load the template. Prefer the DB row (published + admin-controlled); the
    // record shape matches @cs/prompts' TemplateRecord for the prompt builder.
    let template: TemplateRecord | null = null;
    if (gate.kind === "ok") {
      const row = await getTemplate(gate.db, slug);
      if (row) template = row as unknown as TemplateRecord;
    }
    if (!template) {
      // Degraded/dev fallback: use the in-code seed registry.
      const { SEED_TEMPLATES } = await import("@cs/prompts");
      template = SEED_TEMPLATES.find((t) => t.slug === slug) ?? null;
    }
    if (!template) return NextResponse.json({ error: "ไม่พบเทมเพลต" }, { status: 404 });

    // Required-field validation from the template's own form spec.
    for (const f of template.form) {
      if (f.type === "text" && f.required && !formValues[f.key]?.trim()) {
        return NextResponse.json({ error: `กรุณากรอก "${f.label_th}"` }, { status: 400 });
      }
    }

    const systemPrompt = buildViralKitPrompt(template, formValues);
    const result = await run(viralKit, { system_prompt: systemPrompt });

    if (gate.kind === "ok") {
      try {
        await incrementTemplateUsage(gate.db, slug);
        await insertGeneration(gate.db, {
          user_id: gate.userId,
          type: "viral_kit",
          tool: "viral_studio",
          title: `${template.name_th}${formValues.theme ? " · " + formValues.theme : ""}`,
          input: { slug, formValues },
          output: result.output,
          prompt_id: result.prompt_id,
          prompt_rendered: systemPrompt,
          model: result.model,
        });
      } catch {
        // Don't lose the generated kit over a persistence hiccup.
      }
    }

    return NextResponse.json({ kit: result.output, remaining: gate.kind === "ok" ? gate.remaining : undefined });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
