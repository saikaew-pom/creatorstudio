import { NextRequest, NextResponse } from "next/server";
import { addComment, listComments } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const comments = await listComments(getServerSupabase(), params.id);
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ error: "โหลดความคิดเห็นไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { body?: string };
    const text = body.body?.trim();
    if (!text) return NextResponse.json({ error: "กรุณาพิมพ์ความคิดเห็น" }, { status: 400 });
    const comment = await addComment(getServerSupabase(), params.id, active.workspace.id, text);
    return NextResponse.json({ comment });
  } catch {
    return NextResponse.json({ error: "ส่งความคิดเห็นไม่สำเร็จ" }, { status: 500 });
  }
}
