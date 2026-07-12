import { NextRequest, NextResponse } from "next/server";
import { createContact, listContacts } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const companyId = new URL(req.url).searchParams.get("companyId") ?? undefined;
    const contacts = await listContacts(getServerSupabase(), active.workspace.id, companyId);
    return NextResponse.json({ contacts });
  } catch {
    return NextResponse.json({ error: "โหลดผู้ติดต่อไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as {
      name?: string; company_id?: string | null; role_title?: string | null;
      email?: string | null; phone?: string | null; line_id?: string | null;
    };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "กรุณาตั้งชื่อผู้ติดต่อ" }, { status: 400 });
    const contact = await createContact(getServerSupabase(), active.workspace.id, {
      name, company_id: body.company_id ?? null, role_title: body.role_title ?? null,
      email: body.email ?? null, phone: body.phone ?? null, line_id: body.line_id ?? null,
    });
    return NextResponse.json({ contact });
  } catch {
    return NextResponse.json({ error: "สร้างผู้ติดต่อไม่สำเร็จ" }, { status: 500 });
  }
}
