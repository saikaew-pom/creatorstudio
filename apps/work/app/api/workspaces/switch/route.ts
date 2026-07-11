import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listMyWorkspaces } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { ACTIVE_WS_COOKIE, ACTIVE_WS_COOKIE_OPTIONS } from "../../../../lib/workspace";

// Sets the "which workspace am I looking at" cookie. Validated server-side against
// real memberships (not just trusted from the client) even though getActiveWorkspace()
// would also fall back safely on a bogus id — belt and suspenders.
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { workspaceId?: string };
    const workspaceId = body.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: "missing workspaceId" }, { status: 400 });

    const memberships = await listMyWorkspaces(db, userData.user.id);
    if (!memberships.some((w) => w.id === workspaceId))
      return NextResponse.json({ error: "ไม่ใช่สมาชิกของ workspace นี้" }, { status: 403 });

    cookies().set(ACTIVE_WS_COOKIE, workspaceId, ACTIVE_WS_COOKIE_OPTIONS);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "สลับ workspace ไม่สำเร็จ" }, { status: 500 });
  }
}
