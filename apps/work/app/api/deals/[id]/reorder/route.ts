import { NextRequest, NextResponse } from "next/server";
import { reorderDeal } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../../lib/supabase-server";
import { requireFeatureRoute } from "../../../../../lib/workspace";

// Thin passthrough to the reorder_deal RPC (0015 §4) — security definer, re-checks
// is_ws_member+ws_has_feature itself. Returns a GENERIC error on failure rather
// than the RPC's raw message: reorder_deal raises distinct 'deal not found' vs
// 'not authorized' strings (it must look the deal up before it can check the
// caller's membership), and echoing that back would let a member of one
// workspace probe whether an arbitrary deal id exists in ANY workspace on the
// platform — the exact cross-tenant existence-oracle already fixed on the
// equivalent tasks/[id]/reorder route.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
  const { response } = await requireFeatureRoute("work_crm");
  if (response) return response;
  try {
    const body = (await req.json()) as { stageId?: string; prevId?: string | null; nextId?: string | null };
    if (!body.stageId) return NextResponse.json({ error: "กรุณาเลือกขั้นตอน" }, { status: 400 });
    const position = await reorderDeal(
      getServerSupabase(), params.id, body.stageId, body.prevId ?? null, body.nextId ?? null
    );
    return NextResponse.json({ position });
  } catch {
    return NextResponse.json({ error: "ย้ายดีลไม่สำเร็จ" }, { status: 400 });
  }
}
