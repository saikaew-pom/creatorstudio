// MCP tool definitions + handlers (M17, ports the studio pattern — doc 04 §10). Each
// tool runs on behalf of the token's owner (userId) via the admin client, manually
// scoped by user_id (the caller has no session, so RLS can't scope for us). Any RPC
// that would normally resolve the caller via auth.uid() (debit/refund credits, the
// daily quota) uses the explicit-user-id, service-role-only variant from migration
// 0008 instead — see packages/db/src/api-keys.ts and credits.ts.
import {
  contentKit, campaign as campaignModule, imageEnhance, IMAGE_MODEL_CREDITS,
  type ContentKitInput, type CampaignInput, type ImageEnhanceInput,
} from "@cs/prompts";
import { run, generateImage } from "@cs/ai";
import {
  insertGeneration, insertCampaign, uploadGeneratedImage, publicImageUrl,
  debitCreditsForUser, refundCreditsForUser, tryConsumeDailyUseForUser, DAILY_LIMITS,
} from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "generate_content_kit",
    description: "สร้างชุดคอนเทนต์ (hook 5 แบบ · สคริปต์ต่อแพลตฟอร์ม · visual prompts · hashtags) จากหัวข้อ นับเป็นโควตาการสร้างคอนเทนต์รายวัน",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "หัวข้อ/ไอเดีย" },
        niche: { type: "string", description: "ประเภทธุรกิจ (ไม่บังคับ)" },
        template: { type: "string", description: "recipe chip key เช่น sales_post, five_tips (ไม่บังคับ)" },
        platforms: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "tiktok", "youtube", "tts"] } },
      },
      required: ["topic", "platforms"],
    },
  },
  {
    name: "generate_image",
    description: "สร้างภาพจากคำอธิบาย (Standard 1 เครดิต · Pro พร้อมข้อความไทยในภาพ 5 เครดิต)",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "คำอธิบายภาพที่ต้องการ" },
        aspect: { type: "string", enum: ["1:1", "4:5", "9:16", "16:9", "2:3"] },
        thai_text_mode: { type: "boolean", description: "ใส่ข้อความไทยในภาพด้วย (Pro · 5 เครดิต) — ค่าเริ่มต้น false" },
      },
      required: ["description", "aspect"],
    },
  },
  { name: "list_brands", description: "รายการ Brand Voice ทั้งหมดของผู้ใช้", inputSchema: { type: "object", properties: {} } },
  { name: "get_credit_balance", description: "ดูเครดิตคงเหลือและแผนของผู้ใช้", inputSchema: { type: "object", properties: {} } },
  {
    name: "create_campaign",
    description: "วางแผนคอนเทนต์ 7 วันจากหัวข้อเดียว (สตอรี่อาร์ค: รับรู้ → ให้ความรู้ → เชื่อใจ → ปิดการขาย). ใช้ 5 เครดิต",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        niche: { type: "string", description: "ไม่บังคับ" },
      },
      required: ["topic"],
    },
  },
];

type Args = Record<string, unknown>;

export async function callTool(
  admin: SupabaseClient,
  userId: string,
  name: string,
  args: Args
): Promise<unknown> {
  switch (name) {
    case "generate_content_kit": {
      const topic = String(args.topic ?? "").trim();
      if (!topic) throw new Error("ต้องมีหัวข้อ");
      const platforms = Array.isArray(args.platforms) ? (args.platforms as string[]) : [];
      if (!platforms.length) throw new Error("ต้องเลือกอย่างน้อย 1 แพลตฟอร์ม");

      const { data: profile } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
      const plan = (profile?.plan as string) ?? "free";
      const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;
      const remaining = await tryConsumeDailyUseForUser(admin, userId, "content_studio", limit);
      if (remaining < 0) throw new Error(`ใช้ครบโควตาวันนี้แล้ว (${limit}/วัน)`);

      const input: ContentKitInput = {
        topic, niche: args.niche ? String(args.niche) : undefined,
        template: args.template as ContentKitInput["template"],
        platforms: platforms as ContentKitInput["platforms"],
      };
      const result = await run(contentKit, input);
      const gen = await insertGeneration(admin, {
        user_id: userId, type: "content_kit", tool: "content_studio",
        title: result.output.topic_refined, input, output: result.output,
        prompt_id: result.prompt_id, model: result.model,
        niche: input.niche, platform: input.platforms,
      });
      return { kit: result.output, generation_id: gen.id, quota_remaining: remaining };
    }

    case "generate_image": {
      const description = String(args.description ?? "").trim();
      if (!description) throw new Error("ต้องมีคำอธิบายภาพ");
      const aspect = String(args.aspect ?? "4:5") as "1:1" | "4:5" | "9:16" | "16:9" | "2:3";
      const thaiTextMode = Boolean(args.thai_text_mode);
      const tier = thaiTextMode ? "image-pro" : "image-standard";
      const cost = IMAGE_MODEL_CREDITS[tier];

      const balance = await debitCreditsForUser(admin, userId, cost, {
        note: thaiTextMode ? "เจนรูป Pro (MCP)" : "เจนรูป Standard (MCP)", refType: "image_studio",
      });
      if (balance < 0) throw new Error(`เครดิตไม่พอ — ต้องใช้ ${cost} เครดิต`);

      try {
        const enhanceInput: ImageEnhanceInput = { description, aspect, thai_text_mode: thaiTextMode, has_reference_image: false };
        const enhanced = await run(imageEnhance, enhanceInput);
        const promptRendered = [enhanced.output.prompt_en, enhanced.output.negative_en].filter(Boolean).join(" ");
        const image = await generateImage({ prompt: promptRendered, tier, aspectRatio: aspect });

        const gen = await insertGeneration(admin, {
          user_id: userId, type: "image", tool: "image_studio", title: description.slice(0, 80),
          input: args, prompt_id: imageEnhance.id, prompt_rendered: promptRendered,
          model: image.model, credits_spent: cost,
        });
        const path = await uploadGeneratedImage(admin, userId, gen.id, image.data, image.mimeType);
        const url = publicImageUrl(admin, path);
        await admin.from("generations").update({ asset_path: path }).eq("id", gen.id);
        return { url, generation_id: gen.id, credits_spent: cost };
      } catch (e) {
        await refundCreditsForUser(admin, userId, cost, { note: "คืนเครดิต (เจนรูปไม่สำเร็จ · MCP)", refType: "image_studio" });
        throw e;
      }
    }

    case "list_brands": {
      const { data } = await admin.from("brands").select("id,name,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
      return { brands: data ?? [] };
    }

    case "get_credit_balance": {
      const { data: profile } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
      // Admin client bypasses RLS — must filter by user_id explicitly (studio's
      // get_quota hit this same trap; getCreditBalance relies on RLS scoping the
      // session, which doesn't exist here).
      const { data: txns } = await admin.from("credit_transactions").select("amount,bucket").eq("user_id", userId);
      let monthly = 0, purchased = 0;
      for (const r of (txns ?? []) as { amount: number; bucket: string }[]) {
        if (r.bucket === "monthly") monthly += r.amount; else purchased += r.amount;
      }
      return { plan: (profile?.plan as string) ?? "free", monthly, purchased, total: monthly + purchased };
    }

    case "create_campaign": {
      const topic = String(args.topic ?? "").trim();
      if (!topic) throw new Error("ต้องมีหัวข้อ/สินค้า");
      const cost = 5;
      const balance = await debitCreditsForUser(admin, userId, cost, { note: "สร้างแคมเปญ 7 วัน (MCP)", refType: "campaign" });
      if (balance < 0) throw new Error(`เครดิตไม่พอ — ต้องใช้ ${cost} เครดิต`);

      try {
        const input: CampaignInput = { topic, niche: args.niche ? String(args.niche) : undefined };
        const result = await run(campaignModule, input);
        const row = await insertCampaign(admin, { user_id: userId, topic, niche: input.niche, days: result.output.days, credits_spent: cost });
        return { days: result.output.days, campaign_id: row.id, credits_spent: cost };
      } catch (e) {
        await refundCreditsForUser(admin, userId, cost, { note: "คืนเครดิต (สร้างแคมเปญไม่สำเร็จ · MCP)", refType: "campaign" });
        throw e;
      }
    }

    default:
      throw new Error(`ไม่รู้จักเครื่องมือ: ${name}`);
  }
}
