import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { AdminWorkspacesPanel } from "./AdminWorkspacesPanel";

export default async function AdminWorkspacesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <b>⚠ ยังไม่ได้ตั้งค่า Supabase</b>
      </div>
    );
  }

  const db = getServerSupabase();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) {
    return (
      <div className="empty-state">
        <div className="icon">🛠</div>
        <p>เข้าสู่ระบบก่อน</p>
        <Link href="/login?next=/admin/workspaces" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
      </div>
    );
  }

  const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return (
      <div className="empty-state">
        <div className="icon">🔒</div>
        <p>หน้านี้สำหรับแอดมินแพลตฟอร์มเท่านั้น</p>
      </div>
    );
  }

  return <AdminWorkspacesPanel />;
}
