import { NextRequest, NextResponse } from "next/server";
import { adminClient, enqueueRenderJob } from "@cs/db";
import type { CaptionCard, CaptionStyle } from "@cs/captions";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

// Save the (possibly restyled) captions, then enqueue an export job. Export burns the
// caption cards onto the base video — no minute charge (already paid at preview).
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const { projectId, cards, style } = (await req.json()) as {
      projectId: string; cards: CaptionCard[]; style: CaptionStyle;
    };
    if (!projectId || !cards?.length) return NextResponse.json({ error: "ไม่มีซับให้ส่งออก" }, { status: 400 });

    // Persist the current cards + style (RLS: user owns the project → captions).
    const { error: capErr } = await db
      .from("captions")
      .upsert({ project_id: projectId, cards, style, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
    if (capErr) throw capErr;

    // Enqueue export (0 minutes).
    const admin = adminClient();
    const job = await enqueueRenderJob(admin, userData.user.id, projectId, "export", {}, 0);
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "ส่งออกไม่สำเร็จ" }, { status: 500 });
  }
}
