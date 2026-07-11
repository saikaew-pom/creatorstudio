import { NextRequest, NextResponse } from "next/server";
import { listMembers, removeMember, setMemberRole } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    // members_read RLS scopes this to workspaces the caller belongs to — a non-member
    // simply gets an empty result, no separate check needed.
    const members = await listMembers(db, params.id);
    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ error: "โหลดสมาชิกไม่สำเร็จ" }, { status: 500 });
  }
}

// Update a member's role, or remove them. Both are owner/admin-only — enforced by
// the set_member_role / remove_member RPCs themselves (not re-checked here).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { userId?: string; role?: "admin" | "member" | "guest" };
    if (!body.userId || !body.role) return NextResponse.json({ error: "missing userId/role" }, { status: 400 });
    await setMemberRole(db, params.id, body.userId, body.role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "เปลี่ยนบทบาทไม่สำเร็จ" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "missing userId" }, { status: 400 });
    await removeMember(db, params.id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "ลบสมาชิกไม่สำเร็จ" }, { status: 400 });
  }
}
