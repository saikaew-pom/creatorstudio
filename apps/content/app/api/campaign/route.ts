import { NextRequest, NextResponse } from "next/server";
import { campaign as campaignModule, type CampaignInput } from "@cs/prompts";
import { run, AiError } from "@cs/ai";
import { insertCampaign, listCampaigns, debitCredits, refundCredits } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export const maxDuration = 60;

// One planning call replaces what would otherwise be 7 separate content-kit credit
// charges — priced as a single flat cost (M15b, docs/08-content-redesign.md).
const CAMPAIGN_CREDIT_COST = 5;

interface CampaignBody {
  topic?: string;
  niche?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CampaignBody;
    if (!body.topic?.trim()) {
      return NextResponse.json({ error: "กรอกหัวข้อ/สินค้าก่อน" }, { status: 400 });
    }

    // Resolve user + debit credits BEFORE the (slower, "smart"-tier) generation call,
    // refund on failure — same pattern as generate-image. Degrades to no-auth/no-credit
    // mode when Supabase isn't configured.
    let userId: string | null = null;
    let db: ReturnType<typeof getServerSupabase> | null = null;
    if (isSupabaseConfigured()) {
      db = getServerSupabase();
      const { data } = await db.auth.getUser();
      if (!data.user) {
        return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
      }
      userId = data.user.id;
      const remaining = await debitCredits(db, CAMPAIGN_CREDIT_COST, {
        note: "สร้างแคมเปญ 7 วัน", refType: "campaign",
      });
      if (remaining < 0) {
        return NextResponse.json({ error: `เครดิตไม่พอ — ต้องใช้ ${CAMPAIGN_CREDIT_COST} เครดิต` }, { status: 402 });
      }
    }

    const input: CampaignInput = { topic: body.topic, niche: body.niche };

    try {
      const result = await run(campaignModule, input);

      let campaignId: string | undefined;
      if (userId && db) {
        try {
          const row = await insertCampaign(db, {
            user_id: userId, topic: body.topic, niche: body.niche,
            days: result.output.days, credits_spent: CAMPAIGN_CREDIT_COST,
          });
          campaignId = row.id;
        } catch {
          // Persistence failure shouldn't lose the user's generated plan — return it anyway.
        }
      }

      return NextResponse.json({
        days: result.output.days,
        campaignId,
        creditsSpent: userId ? CAMPAIGN_CREDIT_COST : 0,
        meta: { prompt_id: result.prompt_id, model: result.model, latency_ms: result.latency_ms },
      });
    } catch (e) {
      // Refund since we debited before the provider call.
      if (userId && db) {
        await refundCredits(db, CAMPAIGN_CREDIT_COST, { note: "คืนเครดิต (สร้างแคมเปญไม่สำเร็จ)", refType: "campaign" });
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ campaigns: [] });
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  const campaigns = await listCampaigns(db);
  return NextResponse.json({ campaigns });
}
