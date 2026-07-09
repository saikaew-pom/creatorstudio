import { NextRequest, NextResponse } from "next/server";
import {
  upsertProject, enqueueRenderJob, uploadSourceClip, getMinutesUsedThisMonth,
  MINUTE_LIMITS, adminClient,
} from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export const maxDuration = 60;

// Upload-own-clip: accept the user's vertical clip, store it in the private uploads
// bucket (server-side via admin after verifying the session), create an upload-mode
// project, and enqueue an upload render job (normalize → transcribe → captions).
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    const userId = userData.user.id;

    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "อัปคลิปของฉัน");
    if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์วิดีโอ" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 50MB" }, { status: 400 });

    // Minute quota — clip length unknown until processed; pre-charge a conservative 1
    // (worker reconciles to the clip's real duration on completion).
    const { data: profile } = await db.from("profiles").select("plan").eq("id", userId).maybeSingle();
    const plan = (profile?.plan as string) ?? "free";
    const limit = MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free;
    const used = await getMinutesUsedThisMonth(db, userId);
    if (used + 1 > limit) {
      return NextResponse.json({ error: `นาทีไม่พอ — ใช้ไป ${used}/${limit} นาทีเดือนนี้` }, { status: 402 });
    }

    const project = await upsertProject(db, userId, { name, mode: "upload", status: "rendering" });

    const admin = adminClient();
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadPath = await uploadSourceClip(admin, userId, project.id, bytes, ext, file.type || "video/mp4");

    const job = await enqueueRenderJob(admin, userId, project.id, "preview_render",
      { mode: "upload", upload_path: uploadPath }, 1);

    return NextResponse.json({ projectId: project.id, jobId: job.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "อัปโหลดไม่สำเร็จ" }, { status: 500 });
  }
}
