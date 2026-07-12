import { NextRequest, NextResponse } from "next/server";
import { createCompany, listCompanies } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";

export async function GET() {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const companies = await listCompanies(getServerSupabase(), active.workspace.id);
    return NextResponse.json({ companies });
  } catch {
    return NextResponse.json({ error: "โหลดบริษัทไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { name?: string; website?: string | null; industry?: string | null };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "กรุณาตั้งชื่อบริษัท" }, { status: 400 });
    const company = await createCompany(getServerSupabase(), active.workspace.id, {
      name, website: body.website ?? null, industry: body.industry ?? null,
    });
    return NextResponse.json({ company });
  } catch {
    return NextResponse.json({ error: "สร้างบริษัทไม่สำเร็จ" }, { status: 500 });
  }
}
