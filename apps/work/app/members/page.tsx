import Link from "next/link";
import { isSupabaseConfigured } from "../../lib/supabase-server";
import { getWorkspaceContext } from "../../lib/workspace";
import { MembersPanel } from "./MembersPanel";

export default async function MembersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <b>⚠ ยังไม่ได้ตั้งค่า Supabase</b>
      </div>
    );
  }

  const ctx = await getWorkspaceContext();
  if (ctx.kind === "signed-out") {
    return (
      <div className="empty-state">
        <div className="icon">👥</div>
        <p>เข้าสู่ระบบก่อนเพื่อจัดการสมาชิก</p>
        <Link href="/login?next=/members" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
      </div>
    );
  }
  if (ctx.kind === "no-workspace") {
    return (
      <div className="empty-state">
        <div className="icon">⚠️</div>
        <p>ไม่พบ workspace ของคุณ — กรุณาติดต่อทีมงาน</p>
      </div>
    );
  }
  const active = ctx.active;

  const canManage = active.workspace.role === "owner" || active.workspace.role === "admin";
  return <MembersPanel wsId={active.workspace.id} wsName={active.workspace.name} myUserId={active.userId} canManage={canManage} />;
}
