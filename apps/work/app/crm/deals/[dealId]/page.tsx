import Link from "next/link";
import { getDeal, listCompanies, listContacts, listDeliverables, listMembers, listStages } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { requireFeature } from "../../../../lib/workspace";
import { DealDetailPanel } from "./DealDetailPanel";

export default async function DealDetailPage({ params }: { params: { dealId: string } }) {
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
        <div className="icon">🤝</div>
        <p>เข้าสู่ระบบก่อน</p>
        <Link href={`/login?next=/crm/deals/${params.dealId}`} className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
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

  const db = getServerSupabase();
  const deal = await getDeal(db, params.dealId);
  if (!deal || deal.workspace_id !== gate.active.workspace.id) {
    return (
      <div className="empty-state">
        <div className="icon">🤝</div>
        <p>ไม่พบดีลนี้</p>
        <Link href="/crm/deals" className="btn" style={{ marginTop: 10 }}>กลับไปหน้าดีล</Link>
      </div>
    );
  }

  const wsId = gate.active.workspace.id;
  const [stages, companies, contacts, members, deliverables] = await Promise.all([
    listStages(db, wsId),
    listCompanies(db, wsId),
    listContacts(db, wsId),
    listMembers(db, wsId),
    listDeliverables(db, deal.id),
  ]);

  return (
    <DealDetailPanel
      deal={deal}
      stages={stages}
      companies={companies}
      contacts={contacts}
      members={members}
      initialDeliverables={deliverables}
    />
  );
}
