import { NextRequest, NextResponse } from "next/server";
import { createWorkspace, listMyWorkspaces } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export async function GET() {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    const workspaces = await listMyWorkspaces(db, userData.user.id);
    return NextResponse.json({ workspaces });
  } catch {
    return NextResponse.json({ error: "โหลด workspace ไม่สำเร็จ" }, { status: 500 });
  }
}

// Creates an additional TEAM workspace (distinct from the personal one made at
// signup). Owner membership is added by the on_workspace_created trigger (0005 §3).
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "กรุณาตั้งชื่อ workspace" }, { status: 400 });

    const workspace = await createWorkspace(db, name, userData.user.id);
    return NextResponse.json({ workspace });
  } catch {
    return NextResponse.json({ error: "สร้าง workspace ไม่สำเร็จ" }, { status: 500 });
  }
}
