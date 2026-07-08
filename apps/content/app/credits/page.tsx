// Server component: reads the real credit balance + history from the append-only
// ledger when the user is signed in; otherwise shows the packs and a sign-in nudge.
import Link from "next/link";
import { getCreditBalance, getCreditHistory, type CreditTxnRow } from "@cs/db";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";

const PACKS = [
  { name: "เริ่มต้น", credits: 100, price: "฿199", per: "฿1.99/เครดิต", badge: null },
  { name: "คุ้มค่า", credits: 500, price: "฿899", per: "฿1.80/เครดิต · ประหยัด 10%", badge: "ยอดนิยม" },
  { name: "จัดเต็ม", credits: 1000, price: "฿1,599", per: "฿1.60/เครดิต · ประหยัด 20%", badge: "คุ้มที่สุด" },
];

function thDate(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function CreditsPage() {
  let balance: { total: number; monthly: number; purchased: number } | null = null;
  let history: CreditTxnRow[] = [];
  let signedIn = false;

  if (isSupabaseConfigured()) {
    const db = getServerSupabase();
    const { data } = await db.auth.getUser();
    if (data.user) {
      signedIn = true;
      balance = await getCreditBalance(db);
      history = await getCreditHistory(db, 20);
    }
  }

  return (
    <div>
      <h1>เครดิตเจนรูป</h1>
      <p className="dim">ดูเครดิตคงเหลือ · ประวัติ · เติมเครดิต</p>

      {!signedIn && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>ยังไม่ได้เข้าสู่ระบบ</b>
          <p className="dim">
            {isSupabaseConfigured()
              ? "เข้าสู่ระบบเพื่อดูเครดิตและประวัติของคุณ"
              : "ต้องตั้งค่า Supabase ก่อน (ใส่คีย์ใน .env) จึงจะมีระบบเครดิต"}
          </p>
          {isSupabaseConfigured() && <Link href="/login?next=/credits" className="btn primary">เข้าสู่ระบบ</Link>}
        </div>
      )}

      {signedIn && balance && (
        <div className="card">
          <div className="dim">เครดิตคงเหลือ</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{balance.total}</div>
          <div className="dim">
            รายเดือน {balance.monthly} · ซื้อเพิ่ม {balance.purchased} (เครดิตที่ซื้ออยู่ถาวร ไม่หายแม้เปลี่ยนแผน)
          </div>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>เติมเครดิต</h3>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {PACKS.map((p) => (
          <div key={p.name} className="card" style={{ borderColor: p.badge ? "var(--accent)" : undefined }}>
            {p.badge && <span className="pill" style={{ borderColor: "var(--accent)" }}>{p.badge}</span>}
            <h3 style={{ marginTop: p.badge ? 8 : 0 }}>{p.name}</h3>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{p.credits} <span className="dim" style={{ fontSize: 14 }}>เครดิต</span></div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{p.price}</div>
            <div className="dim">{p.per}</div>
            {/* Payment integration (Stripe/Omise PromptPay) is a sensitive action requiring
                real keys + explicit setup — wired in a later pass, not auto-provisioned. */}
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
              disabled title="ต่อระบบชำระเงินในขั้นถัดไป">
              เลือกแพ็กนี้ (เร็วๆ นี้)
            </button>
          </div>
        ))}
      </div>

      {signedIn && (
        <>
          <h3 style={{ marginTop: 24 }}>ประวัติเครดิต</h3>
          <div className="card">
            {history.length === 0 && <p className="dim">ยังไม่มีประวัติ</p>}
            {history.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div>{h.note ?? h.kind}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{thDate(h.created_at)} · {h.bucket}</div>
                </div>
                <div style={{ fontWeight: 700, color: h.amount >= 0 ? "var(--success)" : "var(--text)" }}>
                  {h.amount >= 0 ? "+" : ""}{h.amount}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
