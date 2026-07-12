import { NextRequest, NextResponse } from "next/server";
import { deleteCompany, updateCompany } from "@cs/db";
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
      return NextResponse.json({ error: "กรุณาตั้งชื่อบริษัท" }, { status: 400 });
    const patch: Parameters<typeof updateCompany>[2] = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if ("website" in body) patch.website = (body.website as string | null) ?? null;
    if ("industry" in body) patch.industry = (body.industry as string | null) ?? null;
    if ("notes" in body) patch.notes = (body.notes as string | null) ?? null;
    await updateCompany(getServerSupabase(), params.id, patch);
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
    await deleteCompany(getServerSupabase(), params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบบริษัทไม่สำเร็จ" }, { status: 500 });
  }
}
