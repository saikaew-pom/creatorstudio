import { NextRequest, NextResponse } from "next/server";
import { deleteTask, getTask, updateTask, type TaskPriority } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../lib/workspace";

const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.priority !== undefined && !PRIORITIES.includes(body.priority as TaskPriority))
      return NextResponse.json({ error: "ระดับความสำคัญไม่ถูกต้อง" }, { status: 400 });
    if (typeof body.title === "string" && !body.title.trim())
      return NextResponse.json({ error: "กรุณาตั้งชื่องาน" }, { status: 400 });
    if ("estimate_hours" in body && body.estimate_hours !== null && !isFiniteNonNegative(body.estimate_hours))
      return NextResponse.json({ error: "ชั่วโมงประมาณการไม่ถูกต้อง" }, { status: 400 });

    const patch: Parameters<typeof updateTask>[2] = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if ("description" in body) patch.description = (body.description as string | null) ?? null;
    if (body.priority !== undefined) patch.priority = body.priority as TaskPriority;
    if ("assignee_id" in body) patch.assignee_id = (body.assignee_id as string | null) ?? null;
    if ("start_date" in body) patch.start_date = (body.start_date as string | null) ?? null;
    if ("due_date" in body) patch.due_date = (body.due_date as string | null) ?? null;
    if ("estimate_hours" in body) patch.estimate_hours = (body.estimate_hours as number | null) ?? null;

    const db = getServerSupabase();
    // start_date/due_date are edited independently (separate inputs, separate
    // saves) so a patch touching only one of them still needs the OTHER's
    // current value to validate the pair — fetch first rather than trusting
    // whatever the client happened to send.
    if ("start_date" in patch || "due_date" in patch) {
      const current = await getTask(db, params.id);
      const effectiveStart = "start_date" in patch ? patch.start_date : current?.start_date ?? null;
      const effectiveDue = "due_date" in patch ? patch.due_date : current?.due_date ?? null;
      if (effectiveStart && effectiveDue && effectiveStart > effectiveDue)
        return NextResponse.json({ error: "วันเริ่มต้องไม่เกินวันครบกำหนด" }, { status: 400 });
    }

    // RLS (tasks_all) already scopes this to the caller's own entitled
    // workspace — a task id from elsewhere just matches zero rows.
    await updateTask(db, params.id, patch);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    await deleteTask(getServerSupabase(), params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบงานไม่สำเร็จ" }, { status: 500 });
  }
}
