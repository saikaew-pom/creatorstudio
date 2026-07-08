import { NextRequest, NextResponse } from "next/server";
import { styleClone } from "@cs/prompts";
import { run, AiError } from "@cs/ai";
import { insertStyle } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export const maxDuration = 60;

// §SC — analyze 1-3 sample posts into a reusable writing-style profile, then persist.
export async function POST(req: NextRequest) {
  try {
    const { samples } = (await req.json()) as { samples: string[] };
    const clean = (samples ?? []).map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) {
      return NextResponse.json({ error: "วางตัวอย่างโพสต์ที่ชอบอย่างน้อย 1 อัน" }, { status: 400 });
    }
    const result = await run(styleClone, { samples: clean });

    let styleId: string | undefined;
    if (isSupabaseConfigured()) {
      const db = getServerSupabase();
      const { data: userData } = await db.auth.getUser();
      if (!userData.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
      const row = await insertStyle(db, userData.user.id, result.output.name, result.output, clean);
      styleId = row.id;
    }
    return NextResponse.json({ style: result.output, styleId });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const { deleteStyle } = await import("@cs/db");
    await deleteStyle(db, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
