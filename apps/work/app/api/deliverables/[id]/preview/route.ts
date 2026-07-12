import { NextRequest, NextResponse } from "next/server";
import { adminClient, publicImageUrl, type GenerationRow, type ProjectRow } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

export type DeliverablePreview =
  | { kind: "none" }
  | { kind: "generation"; title: string | null; type: string; niche: string | null; status: string; imageUrl: string | null }
  | { kind: "project"; title: string; mode: string; status: string }
  | { kind: "missing" }; // linked id no longer resolves (asset deleted)

// THE bridge (docs/07-work-crm.md §3 "bridge integrity"). deliverables.generation_id/
// project_id point at PERSONAL tables that are still user_id-scoped — a different
// tenancy model than the workspace tables everything else in apps/work reads. This
// route is the ONLY place that ever crosses that boundary, and it does so in the
// order the doc mandates: confirm the CALLER is a member of the deliverable's own
// (entitled) workspace via the session client + RLS FIRST, then — only after that —
// use the service-role client to read the linked asset by id. A client never gets a
// direct RLS read across the boundary; it also never gets the full generation/
// project row, only a few display-safe fields (never `input`/`output`/`script`).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const db = getServerSupabase();
    // RLS (deliverables_all) scopes this to the caller's own entitled workspace —
    // a deliverable id from elsewhere just matches zero rows, same as every other
    // /api/work|crm route in this app.
    const { data: deliverable, error } = await db
      .from("deliverables").select("generation_id, project_id").eq("id", params.id).maybeSingle();
    if (error) throw error;
    if (!deliverable) return NextResponse.json({ error: "ไม่พบชิ้นงานนี้" }, { status: 404 });

    const preview = await resolvePreview(deliverable.generation_id, deliverable.project_id);
    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ error: "โหลดตัวอย่างไม่สำเร็จ" }, { status: 500 });
  }
}

async function resolvePreview(generationId: string | null, projectId: string | null): Promise<DeliverablePreview> {
  if (generationId) {
    const admin = adminClient();
    const { data } = await admin
      .from("generations")
      .select("title, type, niche, status, asset_path")
      .eq("id", generationId)
      .maybeSingle();
    if (!data) return { kind: "missing" };
    const row = data as Pick<GenerationRow, "title" | "type" | "niche" | "status" | "asset_path">;
    return {
      kind: "generation",
      title: row.title,
      type: row.type,
      niche: row.niche,
      status: row.status,
      imageUrl: row.type === "image" && row.asset_path ? publicImageUrl(admin, row.asset_path) : null,
    };
  }
  if (projectId) {
    const admin = adminClient();
    const { data } = await admin.from("projects").select("name, mode, status").eq("id", projectId).maybeSingle();
    if (!data) return { kind: "missing" };
    const row = data as Pick<ProjectRow, "name" | "mode" | "status">;
    return { kind: "project", title: row.name, mode: row.mode, status: row.status };
  }
  return { kind: "none" };
}
