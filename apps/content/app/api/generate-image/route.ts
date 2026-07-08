import { NextRequest, NextResponse } from "next/server";
import { imageEnhance, IMAGE_MODEL_CREDITS, type ImageEnhanceInput } from "@cs/prompts";
import { run, generateImage, AiError, type ImageTier } from "@cs/ai";
import {
  debitCredits,
  refundCredits,
  insertGeneration,
  uploadGeneratedImage,
  publicImageUrl,
  adminClient,
} from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export const maxDuration = 60;

interface GenerateImageBody {
  description: string;
  niche?: string;
  aspect: "1:1" | "4:5" | "9:16" | "16:9" | "2:3";
  thai_text_mode: boolean;
  reference_image?: { mimeType: string; data: string };
  /** Set when `description` is already a finished, production-quality English
   * image prompt (e.g. Content Studio's own cover/illustration prompts, already
   * built via IMAGE_PROMPT_FORMULA) — skips the §I.1 enhancement call, which
   * would otherwise redundantly re-prompt an already-final prompt. */
  skip_enhance?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateImageBody;
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "พิมพ์คำอธิบายรูปก่อน" }, { status: 400 });
    }
    const tier: ImageTier = body.thai_text_mode ? "image-pro" : "image-standard";
    const cost = IMAGE_MODEL_CREDITS[tier];

    // Resolve user + debit credits BEFORE the provider call (BLUEPRINT P6: debit
    // atomically before spend, refund on failure). Degrades to no-auth/no-credit
    // mode when Supabase isn't configured, matching the rest of the app.
    let userId: string | null = null;
    let db: ReturnType<typeof getServerSupabase> | null = null;
    if (isSupabaseConfigured()) {
      db = getServerSupabase();
      const { data } = await db.auth.getUser();
      if (!data.user) {
        return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
      }
      userId = data.user.id;
      const remaining = await debitCredits(db, cost, {
        note: tier === "image-pro" ? "เจนรูป Pro (ข้อความไทย)" : "เจนรูป Standard",
        refType: "image_studio",
      });
      if (remaining < 0) {
        return NextResponse.json(
          { error: `เครดิตไม่พอ — ต้องใช้ ${cost} เครดิต ไปเติมเครดิตก่อน` },
          { status: 402 }
        );
      }
    }

    try {
      let promptRendered: string;
      let promptId: string;
      if (body.skip_enhance) {
        promptRendered = body.description;
        promptId = "content.kit.v1"; // prompt was already produced by that module
      } else {
        // §I.1 step 1 — enhance the user's raw description into a production prompt.
        const enhanceInput: ImageEnhanceInput = {
          description: body.description,
          niche: body.niche,
          aspect: body.aspect,
          thai_text_mode: body.thai_text_mode,
          has_reference_image: !!body.reference_image,
        };
        const enhanced = await run(imageEnhance, enhanceInput);
        promptRendered = [enhanced.output.prompt_en, enhanced.output.negative_en]
          .filter(Boolean)
          .join(" ");
        promptId = imageEnhance.id;
      }

      const image = await generateImage({
        prompt: promptRendered,
        tier,
        aspectRatio: body.aspect,
        referenceImages: body.reference_image ? [body.reference_image] : undefined,
      });

      if (userId && db) {
        const gen = await insertGeneration(db, {
          user_id: userId,
          type: "image",
          tool: "image_studio",
          title: body.description.slice(0, 80),
          input: body,
          prompt_id: promptId,
          prompt_rendered: promptRendered,
          model: image.model,
          credits_spent: cost,
          niche: body.niche,
        });
        // Storage write uses the service-role client: storage.objects has no RLS
        // policy for authenticated users (verified live — the session-scoped
        // client gets "new row violates row-level security policy"), and this
        // route already authenticated the caller via getUser() above, so an
        // admin-client write here is a deliberate, gated privilege escalation,
        // not a bypass of any check.
        const admin = adminClient();
        const path = await uploadGeneratedImage(admin, userId, gen.id, image.data, image.mimeType);
        const url = publicImageUrl(admin, path);
        await db.from("generations").update({ asset_path: path }).eq("id", gen.id);
        return NextResponse.json({
          url,
          promptRendered,
          generationId: gen.id,
          creditsSpent: cost,
        });
      }

      // Degraded mode: no persistence, return the image inline.
      const dataUrl = `data:${image.mimeType};base64,${image.data.toString("base64")}`;
      return NextResponse.json({ url: dataUrl, promptRendered, creditsSpent: 0 });
    } catch (e) {
      // Refund since we debited before the provider call.
      if (userId && db) {
        await refundCredits(db, cost, {
          note: "คืนเครดิต (เจนรูปไม่สำเร็จ)",
          refType: "image_studio",
        });
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
