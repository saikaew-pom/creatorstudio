import { NextRequest, NextResponse } from "next/server";
import { deleteContact, updateContact } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../lib/workspace";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.name === "string" && !body.name.trim())
      return NextResponse.json({ error: "กรุณาตั้งชื่อผู้ติดต่อ" }, { status: 400 });
    const patch: Parameters<typeof updateContact>[2] = {};
    if ("company_id" in body) patch.company_id = (body.company_id as string | null) ?? null;
    if (typeof body.name === "string") patch.name = body.name.trim();
    if ("role_title" in body) patch.role_title = (body.role_title as string | null) ?? null;
    if ("email" in body) patch.email = (body.email as string | null) ?? null;
    if ("phone" in body) patch.phone = (body.phone as string | null) ?? null;
    if ("line_id" in body) patch.line_id = (body.line_id as string | null) ?? null;
    await updateContact(getServerSupabase(), params.id, patch);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    await deleteContact(getServerSupabase(), params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบผู้ติดต่อไม่สำเร็จ" }, { status: 500 });
  }
}
