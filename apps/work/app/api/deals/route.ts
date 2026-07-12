import { NextRequest, NextResponse } from "next/server";
import { createDeal, listDeals } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function GET() {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const deals = await listDeals(getServerSupabase(), active.workspace.id);
    return NextResponse.json({ deals });
  } catch {
    return NextResponse.json({ error: "โหลดดีลไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as {
      title?: string; stageId?: string; companyId?: string | null; primaryContactId?: string | null;
      ownerId?: string | null; amountThb?: number | null; probability?: number | null; expectedClose?: string | null;
    };
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "กรุณาตั้งชื่อดีล" }, { status: 400 });
    if (!body.stageId) return NextResponse.json({ error: "กรุณาเลือกขั้นตอน" }, { status: 400 });
    if (body.amountThb != null && !isFiniteNonNegative(body.amountThb))
      return NextResponse.json({ error: "มูลค่าดีลไม่ถูกต้อง" }, { status: 400 });
    if (body.probability != null && (!Number.isFinite(body.probability) || body.probability < 0 || body.probability > 100))
      return NextResponse.json({ error: "ความน่าจะเป็นต้องอยู่ระหว่าง 0-100" }, { status: 400 });

    const deal = await createDeal(getServerSupabase(), {
      workspace_id: active.workspace.id, title, stage_id: body.stageId,
      company_id: body.companyId ?? null, primary_contact_id: body.primaryContactId ?? null,
      owner_id: body.ownerId ?? null, amount_thb: body.amountThb ?? null,
      probability: body.probability ?? null, expected_close: body.expectedClose ?? null,
    });
    return NextResponse.json({ deal });
  } catch {
    // Generic message, not the raw thrown error — matches every sibling route in
    // this module (a raw DB/trigger message could leak more than intended, the
    // same class of issue fixed on the reorder routes' cross-tenant existence
    // oracle).
    return NextResponse.json({ error: "สร้างดีลไม่สำเร็จ" }, { status: 400 });
  }
}
