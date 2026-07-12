import { NextRequest, NextResponse } from "next/server";
import { listGenerations, listProjects } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../lib/workspace";

// Feeds the deliverable-linking picker with the CALLER'S OWN studio assets —
// plain session-client reads (RLS: user_id = auth.uid()), no bridge/service-role
// needed here since this never crosses the tenancy boundary: you can only ever
// link an asset you already own (docs/07-work-crm.md §3), so listing your own
// assets to choose from is just an ordinary personal-table read.
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const kind = new URL(req.url).searchParams.get("kind");
    const db = getServerSupabase();
    if (kind === "project") {
      const projects = await listProjects(db);
      return NextResponse.json({ projects });
    }
    const type = kind === "image" ? "image" : kind === "content_kit" ? "content_kit" : undefined;
    const generations = await listGenerations(db, { type, limit: 50 });
    return NextResponse.json({ generations });
  } catch {
    return NextResponse.json({ error: "โหลดผลงานไม่สำเร็จ" }, { status: 500 });
  }
}
