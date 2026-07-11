import { NextResponse } from "next/server";
import { adminClient, adminListWorkspaces } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";

// Platform-admin overview across ALL workspaces (not just ones the admin belongs to),
// so the listing itself runs on adminClient() — but only after confirming the CALLER
// is actually a platform admin via their own session (never trust a client claim).
export async function GET() {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin")
      return NextResponse.json({ error: "สำหรับแอดมินแพลตฟอร์มเท่านั้น" }, { status: 403 });

    const workspaces = await adminListWorkspaces(adminClient());
    return NextResponse.json({ workspaces });
  } catch {
    return NextResponse.json({ error: "โหลดรายการ workspace ไม่สำเร็จ" }, { status: 500 });
  }
}
