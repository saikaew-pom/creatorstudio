import { NextRequest, NextResponse } from "next/server";
import { deleteDeal, updateDeal } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../lib/workspace";

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.title === "string" && !body.title.trim())
      return NextResponse.json({ error: "กรุณาตั้งชื่อดีล" }, { status: 400 });
    if ("amount_thb" in body && body.amount_thb !== null && !isFiniteNonNegative(body.amount_thb))
      return NextResponse.json({ error: "มูลค่าดีลไม่ถูกต้อง" }, { status: 400 });
    if ("probability" in body && body.probability !== null) {
      const p = body.probability as number;
      if (!Number.isFinite(p) || p < 0 || p > 100)
        return NextResponse.json({ error: "ความน่าจะเป็นต้องอยู่ระหว่าง 0-100" }, { status: 400 });
    }

    const patch: Parameters<typeof updateDeal>[2] = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if ("company_id" in body) patch.company_id = (body.company_id as string | null) ?? null;
    if ("primary_contact_id" in body) patch.primary_contact_id = (body.primary_contact_id as string | null) ?? null;
    if ("owner_id" in body) patch.owner_id = (body.owner_id as string | null) ?? null;
    if ("amount_thb" in body) patch.amount_thb = (body.amount_thb as number | null) ?? null;
    if ("probability" in body) patch.probability = (body.probability as number | null) ?? null;
    if ("expected_close" in body) patch.expected_close = (body.expected_close as string | null) ?? null;
    if ("source" in body) patch.source = (body.source as string | null) ?? null;
    if ("notes" in body) patch.notes = (body.notes as string | null) ?? null;

    await updateDeal(getServerSupabase(), params.id, patch);
    return NextResponse.json({ ok: true });
  } catch {
    // Generic message, not the raw thrown error — matches every sibling route.
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    await deleteDeal(getServerSupabase(), params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบดีลไม่สำเร็จ" }, { status: 500 });
  }
}
