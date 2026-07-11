import Link from "next/link";
import { hasFeature, listMembers } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getWorkspaceContext } from "../../lib/workspace";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ", admin: "แอดมิน", member: "สมาชิก", guest: "ผู้เยี่ยมชม",
};

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <b>⚠ ยังไม่ได้ตั้งค่า Supabase</b>
        <p className="dim">ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env ก่อน</p>
      </div>
    );
  }

  const ctx = await getWorkspaceContext();
  if (ctx.kind === "signed-out") {
    return (
      <div className="empty-state">
        <div className="icon">🗂️</div>
        <p>เข้าสู่ระบบก่อนเพื่อดู workspace ของคุณ</p>
        <Link href="/login?next=/dashboard" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
      </div>
    );
  }
  if (ctx.kind === "no-workspace") {
    return (
      <div className="empty-state">
        <div className="icon">⚠️</div>
        <p>ไม่พบ workspace ของคุณ — ปกติแล้วบัญชีใหม่ทุกบัญชีจะมี workspace ส่วนตัวอัตโนมัติ</p>
        <p className="dim">นี่ไม่ควรเกิดขึ้น กรุณาติดต่อทีมงาน</p>
      </div>
    );
  }
  const active = ctx.active;

  const db = getServerSupabase();
  const [entitled, members] = await Promise.all([
    hasFeature(db, active.workspace.id, "work_crm"),
    listMembers(db, active.workspace.id),
  ]);

  return (
    <div>
      <h1>{active.workspace.name}</h1>
      <p className="dim" style={{ marginBottom: 20 }}>
        คุณคือ {ROLE_LABEL[active.workspace.role] ?? active.workspace.role} · {members.length} สมาชิก
      </p>

      {entitled ? (
        <div className="card">
          <h3>✅ เปิดใช้งาน Work + CRM แล้ว</h3>
          <p className="dim">
            บอร์ดงาน ปฏิทิน แกนต์ ภาระงาน และ CRM ดีลสปอนเซอร์ กำลังจะมาใน M10–M11
            (ดู <code>docs/07-work-crm.md</code>) — ตอนนี้จัดการสมาชิก workspace ได้ที่หน้า
            {" "}<Link href="/members" style={{ color: "var(--accent)" }}>สมาชิก</Link>
          </p>
        </div>
      ) : (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <h3>🔒 Workspace นี้ยังไม่เปิดใช้งาน Work + CRM</h3>
          <p className="dim">
            ฟีเจอร์นี้เปิดทีละ workspace โดยแอดมินแพลตฟอร์ม (beta allow-list) — ติดต่อทีมงานเพื่อขอเปิดใช้งาน
          </p>
        </div>
      )}

      <div className="card">
        <h3>สมาชิก</h3>
        <p className="dim" style={{ marginBottom: 10 }}>
          {members.length} คนอยู่ใน workspace นี้ — จัดการคำเชิญและบทบาทได้ที่หน้า สมาชิก
        </p>
        <Link href="/members" className="btn">ไปที่หน้าสมาชิก</Link>
      </div>
    </div>
  );
}
