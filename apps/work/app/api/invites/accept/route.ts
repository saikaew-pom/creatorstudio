import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { acceptInvite } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { ACTIVE_WS_COOKIE, ACTIVE_WS_COOKIE_OPTIONS } from "../../../../lib/workspace";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { token?: string };
    if (!body.token) return NextResponse.json({ error: "missing token" }, { status: 400 });

    const workspaceId = await acceptInvite(db, body.token);
    cookies().set(ACTIVE_WS_COOKIE, workspaceId, ACTIVE_WS_COOKIE_OPTIONS);
    return NextResponse.json({ workspaceId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "รับคำเชิญไม่สำเร็จ" }, { status: 400 });
  }
}
