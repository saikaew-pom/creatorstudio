import Link from "next/link";
import { isSupabaseConfigured } from "../../lib/supabase-server";
import { requireFeature } from "../../lib/workspace";
import { WorkloadView } from "./WorkloadView";

export default async function WorkloadPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <b>⚠ ยังไม่ได้ตั้งค่า Supabase</b>
      </div>
    );
  }

  const gate = await requireFeature("work_crm");
  if (gate.kind === "signed-out") {
    return (
      <div className="empty-state">
        <div className="icon">⚖</div>
        <p>เข้าสู่ระบบก่อน</p>
        <Link href="/login?next=/workload" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
      </div>
    );
  }
  if (gate.kind === "no-workspace") {
    return (
      <div className="empty-state">
        <div className="icon">⚠️</div>
        <p>ไม่พบ workspace ของคุณ — กรุณาติดต่อทีมงาน</p>
      </div>
    );
  }
  if (gate.kind === "not-entitled") {
    return (
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <h3>🔒 Workspace นี้ยังไม่เปิดใช้งาน Work + CRM</h3>
      </div>
    );
  }

  return <WorkloadView />;
}
