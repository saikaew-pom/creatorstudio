import { NextRequest, NextResponse } from "next/server";
import { addDealActivity, listDealActivity } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

const MANUAL_KINDS = ["note", "call", "email", "meeting"] as const;
type ManualKind = (typeof MANUAL_KINDS)[number];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const activity = await listDealActivity(getServerSupabase(), params.id);
    return NextResponse.json({ activity });
  } catch {
    return NextResponse.json({ error: "โหลดไทม์ไลน์ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { kind?: string; body?: string };
    if (!MANUAL_KINDS.includes(body.kind as ManualKind))
      return NextResponse.json({ error: "ประเภทกิจกรรมไม่ถูกต้อง" }, { status: 400 });
    const text = body.body?.trim();
    if (!text) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความ" }, { status: 400 });
    const entry = await addDealActivity(getServerSupabase(), params.id, active.workspace.id, body.kind as ManualKind, text);
    return NextResponse.json({ activity: entry });
  } catch {
    return NextResponse.json({ error: "บันทึกกิจกรรมไม่สำเร็จ" }, { status: 500 });
  }
}
