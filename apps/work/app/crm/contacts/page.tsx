import Link from "next/link";
import { listCompanies, listContacts } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { requireFeature } from "../../../lib/workspace";
import { ContactsPanel } from "./ContactsPanel";

export default async function ContactsPage() {
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
        <div className="icon">👤</div>
        <p>เข้าสู่ระบบก่อนเพื่อดูผู้ติดต่อ</p>
        <Link href="/login?next=/crm/contacts" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
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
        <p className="dim">ติดต่อทีมงานเพื่อขอเปิดใช้งานฟีเจอร์นี้</p>
      </div>
    );
  }

  const db = getServerSupabase();
  const wsId = gate.active.workspace.id;
  const [contacts, companies] = await Promise.all([
    listContacts(db, wsId),
    listCompanies(db, wsId),
  ]);

  return <ContactsPanel initialContacts={contacts} companies={companies} wsId={wsId} />;
}
