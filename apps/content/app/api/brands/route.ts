import { NextRequest, NextResponse } from "next/server";
import { BrandSchema } from "@cs/prompts";
import { insertBrand, deleteBrand } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

// Persist a reviewed brand profile (wizard step 2 → save). Validates the profile
// against BrandSchema before writing so a tampered payload can't land malformed JSON.
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const body = (await req.json()) as { name?: string; data: unknown; assets?: Record<string, unknown> };
    const parsed = BrandSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "ข้อมูลแบรนด์ไม่ครบ/ไม่ถูกต้อง" }, { status: 400 });
    }
    const row = await insertBrand(
      db,
      userData.user.id,
      body.name?.trim() || parsed.data.name,
      parsed.data,
      body.assets ?? {}
    );
    return NextResponse.json({ brand: row });
  } catch {
    return NextResponse.json({ error: "บันทึกแบรนด์ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isSupabaseConfigured())
      return NextResponse.json({ error: "ต้องตั้งค่า Supabase ก่อน" }, { status: 400 });
    const db = getServerSupabase();
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    await deleteBrand(db, id); // RLS ensures the user can only delete their own
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
