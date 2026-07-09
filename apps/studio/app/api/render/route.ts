import { NextRequest, NextResponse } from "next/server";
import { splitScript } from "@cs/prompts";
import {
  upsertProject, enqueueRenderJob, getMinutesUsedThisMonth, MINUTE_LIMITS,
  adminClient,
} from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

// Enqueue a preview render. Creates/updates the project, checks the monthly minute
// quota, and inserts a queued render_jobs row for the worker to pick up. The actual
// render happens in the background worker (renders are minutes-long — never inline).
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    const userId = userData.user.id;

    const { projectId, name, script, voice, brollTier } = (await req.json()) as {
      projectId?: string; name?: string; script: string; voice: string; brollTier: "ai" | "stock";
    };
    if (!script?.trim()) return NextResponse.json({ error: "ยังไม่มีสคริปต์" }, { status: 400 });

    const segments = splitScript(script);
    // Rough estimate for the pre-charge (worker reconciles to actual on completion).
    const estMinutes = Math.max(1, Math.ceil(segments[segments.length - 1].est_end / 60));

    // Minute quota check.
    const { data: profile } = await db.from("profiles").select("plan").eq("id", userId).maybeSingle();
    const plan = (profile?.plan as string) ?? "free";
    const limit = MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free;
    const used = await getMinutesUsedThisMonth(db, userId);
    if (used + estMinutes > limit) {
      return NextResponse.json(
        { error: `นาทีไม่พอ — ใช้ไป ${used}/${limit} นาทีเดือนนี้ · อัปเกรดแผนหรือเติมเครดิต` },
        { status: 402 }
      );
    }

    const project = await upsertProject(db, userId, {
      id: projectId, name: name || "New Project", mode: "script", script,
      segments, status: "rendering",
    });

    // Enqueue with admin client so the worker (also admin) sees a consistent row;
    // minutes_charged records the estimate for reconciliation.
    const admin = adminClient();
    const job = await enqueueRenderJob(
      admin, userId, project.id, "preview_render",
      { script, voice, brollTier }, estMinutes
    );

    return NextResponse.json({ projectId: project.id, jobId: job.id, estMinutes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "เริ่มเรนเดอร์ไม่สำเร็จ" }, { status: 500 });
  }
}

// Poll job status (studio editor polls this while rendering).
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: "unconfigured" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });
    const { data } = await db.from("render_jobs").select("status,progress,step_label,result_path,error,project_id").eq("id", jobId).maybeSingle();
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
