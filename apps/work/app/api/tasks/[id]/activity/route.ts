import { NextRequest, NextResponse } from "next/server";
import { listActivity } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const activity = await listActivity(getServerSupabase(), params.id);
    return NextResponse.json({ activity });
  } catch {
    return NextResponse.json({ error: "โหลดประวัติไม่สำเร็จ" }, { status: 500 });
  }
}
