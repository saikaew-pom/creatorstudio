import { NextRequest, NextResponse } from "next/server";
import { adminClient, countInvitesSince, createInvite, listPendingInvites } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_ROLES = ["admin", "member", "guest"] as const;
const MAX_INVITES_PER_HOUR = 20;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    const invites = await listPendingInvites(db, params.id);
    return NextResponse.json({ invites });
  } catch {
    return NextResponse.json({ error: "โหลดคำเชิญไม่สำเร็จ" }, { status: 500 });
  }
}

// Creates the invite row (create_invite RPC, owner/admin-only) then tries to email it
// via Supabase Auth's own invite flow — no new email provider needed. If the address
// already has an account, inviteUserByEmail errors ("already registered"); that's not
// a failure of the invite itself, so we still return the link for the owner to share
// manually (e.g. paste into LINE/Slack).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    const role = body.role ?? "member";
    if (!INVITE_ROLES.includes(role as (typeof INVITE_ROLES)[number]))
      return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });

    // Cheap per-workspace rate limit — create_invite also fires a real Supabase
    // auth email, so an unbounded loop here means real email spam, not just noise.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await countInvitesSince(db, params.id, oneHourAgo);
    if (recent >= MAX_INVITES_PER_HOUR)
      return NextResponse.json({ error: "ส่งคำเชิญบ่อยเกินไป — ลองใหม่ภายหลัง" }, { status: 429 });

    const token = await createInvite(db, params.id, email, role as "admin" | "member" | "guest");
    const origin = new URL(req.url).origin;
    const inviteUrl = `${origin}/invite?token=${token}`;

    let emailSent = false;
    try {
      const { error } = await adminClient().auth.admin.inviteUserByEmail(email, { redirectTo: inviteUrl });
      emailSent = !error;
    } catch {
      emailSent = false; // e.g. already registered — inviteUrl below still works
    }

    return NextResponse.json({ inviteUrl, emailSent });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "สร้างคำเชิญไม่สำเร็จ" }, { status: 400 });
  }
}
