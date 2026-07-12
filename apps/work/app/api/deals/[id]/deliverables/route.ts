import { NextRequest, NextResponse } from "next/server";
import { createDeliverable, getGeneration, getProject, listDeliverables, type DeliverableKind } from "@cs/db";
import { getServerSupabase, getUserId, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

const KINDS: DeliverableKind[] = ["content_kit", "image", "video", "post", "other"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const deliverables = await listDeliverables(getServerSupabase(), params.id);
    return NextResponse.json({ deliverables });
  } catch {
    return NextResponse.json({ error: "โหลดชิ้นงานไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { active, response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as {
      kind?: DeliverableKind; title?: string; dueDate?: string | null;
      generationId?: string | null; projectId?: string | null;
    };
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "กรุณาตั้งชื่อชิ้นงาน" }, { status: 400 });
    if (!body.kind || !KINDS.includes(body.kind))
      return NextResponse.json({ error: "ประเภทชิ้นงานไม่ถูกต้อง" }, { status: 400 });

    const db = getServerSupabase();
    const userId = await getUserId();
    // "The link action is validated in the app: only a workspace member may
    // link, and only to an asset they own" (docs/07 §3) — getGeneration/getProject
    // run through the CALLER's own session client, so RLS (user_id = auth.uid())
    // already guarantees a hit here is the caller's own asset; a foreign id just
    // resolves to null, same as everywhere else this codebase treats "RLS
    // returned nothing" as "not yours, don't proceed."
    if (body.generationId && !(await getGeneration(db, body.generationId)))
      return NextResponse.json({ error: "ไม่พบผลงานนี้ในบัญชีของคุณ" }, { status: 400 });
    if (body.projectId && !(await getProject(db, body.projectId)))
      return NextResponse.json({ error: "ไม่พบโปรเจกต์นี้ในบัญชีของคุณ" }, { status: 400 });

    const deliverable = await createDeliverable(db, {
      workspace_id: active.workspace.id, deal_id: params.id, kind: body.kind, title,
      due_date: body.dueDate ?? null, generation_id: body.generationId ?? null, project_id: body.projectId ?? null,
      owner_user_id: (body.generationId || body.projectId) ? userId : null,
    });
    return NextResponse.json({ deliverable });
  } catch {
    return NextResponse.json({ error: "สร้างชิ้นงานไม่สำเร็จ" }, { status: 500 });
  }
}
