import { NextRequest, NextResponse } from "next/server";
import { createBoard, listBoards, type BoardView } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";

const VIEWS: BoardView[] = ["list", "board", "calendar", "gantt"];

export async function GET() {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const boards = await listBoards(getServerSupabase(), active.workspace.id);
    return NextResponse.json({ boards });
  } catch {
    return NextResponse.json({ error: "โหลดบอร์ดไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { name?: string; defaultView?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "กรุณาตั้งชื่อบอร์ด" }, { status: 400 });
    const defaultView = VIEWS.includes(body.defaultView as BoardView) ? (body.defaultView as BoardView) : "board";
    const board = await createBoard(getServerSupabase(), active.workspace.id, name, defaultView);
    return NextResponse.json({ board });
  } catch {
    return NextResponse.json({ error: "สร้างบอร์ดไม่สำเร็จ" }, { status: 500 });
  }
}
