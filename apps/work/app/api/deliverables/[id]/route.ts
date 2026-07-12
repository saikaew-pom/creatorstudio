import { NextRequest, NextResponse } from "next/server";
import {
  deleteDeliverable, getGeneration, getProject, updateDeliverable, updateDeliverableLink,
  type DeliverableKind, type DeliverableStatus,
} from "@cs/db";
import { getServerSupabase, getUserId, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../lib/workspace";

const KINDS: DeliverableKind[] = ["content_kit", "image", "video", "post", "other"];
const STATUSES: DeliverableStatus[] = ["todo", "in_production", "in_review", "approved", "published"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.kind !== undefined && !KINDS.includes(body.kind as DeliverableKind))
      return NextResponse.json({ error: "ประเภทชิ้นงานไม่ถูกต้อง" }, { status: 400 });
    if (body.status !== undefined && !STATUSES.includes(body.status as DeliverableStatus))
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    if (typeof body.title === "string" && !body.title.trim())
      return NextResponse.json({ error: "กรุณาตั้งชื่อชิ้นงาน" }, { status: 400 });

    const db = getServerSupabase();
    const patch: Parameters<typeof updateDeliverable>[2] = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (body.kind !== undefined) patch.kind = body.kind as DeliverableKind;
    if (body.status !== undefined) patch.status = body.status as DeliverableStatus;
    if ("due_date" in body) patch.due_date = (body.due_date as string | null) ?? null;

    // Re-linking goes through updateDeliverableLink, NOT the generic patch
    // below — generation_id/project_id/owner_user_id need the same
    // caller-owns-this-asset validation createDeliverable does, which a
    // blanket field patch here would bypass. updateDeliverableLink also
    // throws (rather than silently no-op'ing) if the id doesn't resolve or
    // the DB trigger rejects the write — a bare `.update()` here would
    // swallow both cases and still report `{ ok: true }`.
    if ("generation_id" in body || "project_id" in body) {
      const userId = await getUserId();
      const genId = (body.generation_id as string | null) ?? null;
      const projId = (body.project_id as string | null) ?? null;
      if (genId && !(await getGeneration(db, genId)))
        return NextResponse.json({ error: "ไม่พบผลงานนี้ในบัญชีของคุณ" }, { status: 400 });
      if (projId && !(await getProject(db, projId)))
        return NextResponse.json({ error: "ไม่พบโปรเจกต์นี้ในบัญชีของคุณ" }, { status: 400 });
      await updateDeliverableLink(db, params.id, {
        generation_id: genId, project_id: projId, owner_user_id: genId || projId ? userId : null,
      });
    }

    if (Object.keys(patch).length > 0) await updateDeliverable(db, params.id, patch);
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
    await deleteDeliverable(getServerSupabase(), params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบชิ้นงานไม่สำเร็จ" }, { status: 500 });
  }
}
