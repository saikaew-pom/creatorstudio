import { NextRequest, NextResponse } from "next/server";
import { computeWorkload, listMembers, listWorkspaceTasksInRange } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";
import { addDaysIso, todayIsoBangkok } from "../../../lib/dates";

// Default window is THIS week (7 days from today) — capacity_hours (0005) is a
// per-member WEEKLY figure, so summing a longer window against it would flag
// everyone as over-allocated regardless of actual pace. ?since=&until= override
// for a different window, but same-unit (hours/week vs hours-in-window) is the
// caller's responsibility then. "Today" is Bangkok-local (see lib/dates.ts) —
// this server runs in UTC, so a bare UTC "today" is the wrong calendar day for
// roughly 7 of every 24 hours (00:00–07:00 Bangkok time).
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const { searchParams } = new URL(req.url);
    const today = todayIsoBangkok();
    const since = searchParams.get("since") ?? today;
    const until = searchParams.get("until") ?? addDaysIso(today, 6);

    const db = getServerSupabase();
    const [members, tasks] = await Promise.all([
      listMembers(db, active.workspace.id),
      listWorkspaceTasksInRange(db, active.workspace.id, since, until),
    ]);
    const workload = computeWorkload(members, tasks);
    return NextResponse.json({ workload, since, until });
  } catch {
    return NextResponse.json({ error: "โหลดภาระงานไม่สำเร็จ" }, { status: 500 });
  }
}
