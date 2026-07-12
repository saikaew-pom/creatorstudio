import { NextRequest, NextResponse } from "next/server";
import { reorderTask, type TaskStatus } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

// Thin passthrough to the reorder_task RPC (0006 §4) — the RPC itself re-checks
// is_ws_member+ws_has_feature (it's security definer, so it must; RLS on the
// underlying UPDATE doesn't apply inside a definer function) and does the
// advisory-locked fractional-position math. This route only validates shape.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { status?: string; prevId?: string | null; nextId?: string | null };
    if (!STATUSES.includes(body.status as TaskStatus))
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    const position = await reorderTask(
      getServerSupabase(), params.id, body.status as TaskStatus, body.prevId ?? null, body.nextId ?? null
    );
    return NextResponse.json({ position });
  } catch {
    // reorder_task raises distinct 'task not found' vs 'not authorized' messages
    // (it must look the task up before it can check the caller's membership,
    // since it's security definer and runs before RLS would otherwise apply) —
    // echoing that message would let a member of one workspace probe whether an
    // arbitrary task id exists in ANY workspace on the platform. Every sibling
    // route in this module returns a generic message for the same reason.
    return NextResponse.json({ error: "ย้ายงานไม่สำเร็จ" }, { status: 400 });
  }
}
