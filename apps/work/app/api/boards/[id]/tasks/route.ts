import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasksForBoard, type TaskPriority } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    // RLS (boards_all/tasks_all) scopes this to the caller's own workspace
    // regardless of which board id is passed — a foreign board's tasks belong
    // to a workspace_id the caller isn't a member of, so the query just
    // returns zero rows rather than needing a separate ownership check here.
    const tasks = await listTasksForBoard(getServerSupabase(), params.id);
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "โหลดงานไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as {
      title?: string; assigneeId?: string | null; priority?: TaskPriority;
      startDate?: string | null; dueDate?: string | null; estimateHours?: number | null;
    };
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "กรุณาตั้งชื่องาน" }, { status: 400 });
    if (body.priority !== undefined && !PRIORITIES.includes(body.priority))
      return NextResponse.json({ error: "ระดับความสำคัญไม่ถูกต้อง" }, { status: 400 });
    if (body.estimateHours != null && !isFiniteNonNegative(body.estimateHours))
      return NextResponse.json({ error: "ชั่วโมงประมาณการไม่ถูกต้อง" }, { status: 400 });
    if (body.startDate && body.dueDate && body.startDate > body.dueDate)
      return NextResponse.json({ error: "วันเริ่มต้องไม่เกินวันครบกำหนด" }, { status: 400 });
    // workspace_id always comes from the server-resolved active workspace, never
    // the client — the composite FK (board_id, workspace_id) then rejects a
    // board_id that doesn't actually belong to it.
    const task = await createTask(getServerSupabase(), {
      workspace_id: active.workspace.id, board_id: params.id, title,
      assignee_id: body.assigneeId ?? null, priority: body.priority,
      start_date: body.startDate ?? null, due_date: body.dueDate ?? null,
      estimate_hours: body.estimateHours ?? null,
    });
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "สร้างงานไม่สำเร็จ" }, { status: 500 });
  }
}
