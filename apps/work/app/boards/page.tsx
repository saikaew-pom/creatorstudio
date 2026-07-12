import Link from "next/link";
import { listBoards } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { requireFeature } from "../../lib/workspace";
import { CreateBoardForm } from "./CreateBoardForm";

export default async function BoardsPage() {
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
        <div className="icon">▦</div>
        <p>เข้าสู่ระบบก่อนเพื่อดูบอร์ดงาน</p>
        <Link href="/login?next=/boards" className="btn primary" style={{ marginTop: 10 }}>เข้าสู่ระบบ</Link>
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

  const boards = await listBoards(getServerSupabase(), gate.active.workspace.id);

  return (
    <div>
      <h1>บอร์ดงาน</h1>
      <p className="dim" style={{ marginBottom: 20 }}>{gate.active.workspace.name}</p>

      <CreateBoardForm />

      <div className="grid2">
        {boards.map((b) => (
          <Link key={b.id} href={`/boards/${b.id}`} className="card" style={{ display: "block" }}>
            <h3 style={{ margin: 0 }}>{b.name}</h3>
            <span className="dim" style={{ fontSize: 12 }}>มุมมองเริ่มต้น: {b.default_view}</span>
          </Link>
        ))}
        {boards.length === 0 && (
          <div className="empty-state">
            <div className="icon">▦</div>
            <p>ยังไม่มีบอร์ด — สร้างบอร์ดแรกด้านบน</p>
          </div>
        )}
      </div>
    </div>
  );
}
