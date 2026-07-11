import { NextRequest, NextResponse } from "next/server";
import { grantFeature, revokeFeature } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";

// Grant/revoke calls MUST go through the caller's own session client (not
// adminClient) — grant_feature/revoke_feature check `profiles.role` for
// `auth.uid()`, which is null under a service-role connection. That's also
// the real authorization boundary here: this route is a thin passthrough,
// the RPC itself is what refuses a non-admin.
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as {
      workspaceId?: string; feature?: string; action?: "grant" | "revoke"; expiresAt?: string | null;
    };
    if (!body.workspaceId || !body.feature || !body.action)
      return NextResponse.json({ error: "missing workspaceId/feature/action" }, { status: 400 });

    if (body.action === "grant") {
      await grantFeature(db, body.workspaceId, body.feature, body.expiresAt ?? null);
    } else {
      await revokeFeature(db, body.workspaceId, body.feature);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "อัปเดตสิทธิ์ไม่สำเร็จ" }, { status: 400 });
  }
}
