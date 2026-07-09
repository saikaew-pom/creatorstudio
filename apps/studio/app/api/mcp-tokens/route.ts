import { NextRequest, NextResponse } from "next/server";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

async function requireUser() {
  if (!isSupabaseConfigured()) return { error: "ต้องตั้งค่า Supabase ก่อน", status: 400 as const };
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: "กรุณาเข้าสู่ระบบก่อน", status: 401 as const };
  return { db, userId: data.user.id };
}

export async function GET() {
  const u = await requireUser();
  if ("error" in u) return NextResponse.json({ error: u.error }, { status: u.status });
  return NextResponse.json({ tokens: await listMcpTokens(u.db) });
}

export async function POST(req: NextRequest) {
  const u = await requireUser();
  if ("error" in u) return NextResponse.json({ error: u.error }, { status: u.status });
  const { name } = (await req.json()) as { name?: string };
  const { token, row } = await createMcpToken(u.db, u.userId, name?.trim() || "Token");
  // token returned exactly once; the client must copy it now.
  return NextResponse.json({ token, row });
}

export async function DELETE(req: NextRequest) {
  const u = await requireUser();
  if ("error" in u) return NextResponse.json({ error: u.error }, { status: u.status });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await revokeMcpToken(u.db, id);
  return NextResponse.json({ ok: true });
}
