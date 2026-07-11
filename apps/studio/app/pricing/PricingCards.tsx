"use client";
import { useState } from "react";

// Plans mirror Hero AI's studio pricing. Prices are informational — real payment
// (PromptPay/card) is a sensitive action that needs live keys, so CTAs don't charge.
// Founder discount 50%; yearly = 2 months free (pay 10). The displayed yearly-founder
// prices work out to Pro ฿250 / Business ฿413, matching the reference.
interface Plan {
  key: string;
  name: string;
  tagline: string;
  base: number; // monthly list price (THB), 0 = free
  recommended?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  { key: "free", name: "Free", tagline: "ทดลองฟรี ก่อนตัดสินใจ", base: 0, features: [
    "ทดลอง PRO ฟรี 7 วัน — ครบทุกฟีเจอร์ · 15 นาทีช่วงทดลอง",
    "หลังทดลอง: 5 นาที/เดือน · คลิปสั้น 2 นาที · เก็บ 3 วัน",
    "ระบบจัดการ AI ให้ — ไม่ต้องใส่ key เอง",
    "ซับไทย + B-roll อัตโนมัติ",
  ] },
  { key: "pro", name: "Pro", tagline: "คุ้มสุดสำหรับครีเอเตอร์ที่โพสต์ประจำ", base: 599, recommended: true, features: [
    "80 นาที/เดือน · ~80 คลิป · ยาวสุด 6 นาที",
    "ระบบจัดการ AI (Gemini + MiniMax) ให้ — ไม่ต้องใส่ key เอง",
    "เสียง AI ไทยธรรมชาติ (MiniMax) + ซับคาราโอเกะ",
    "ต่อ Agent / MCP ได้ (Claude, Claude Code, ฯลฯ)",
    "เก็บวิดีโอ 14 วัน",
  ] },
  { key: "business", name: "Business", tagline: "สำหรับทีม/เอเจนซีที่ผลิตเยอะ", base: 990, features: [
    "ทุกอย่างใน PRO",
    "150 นาที/เดือน · ~150 คลิป (เกือบ 2 เท่า PRO)",
    "คลิปยาวสุด 10 นาที",
    "เก็บวิดีโอ 14 วัน",
    "Priority Support ตอบไวกว่า",
  ] },
];

function priceOf(base: number, yearly: boolean): { now: number; was: number } {
  if (base === 0) return { now: 0, was: 0 };
  const perMonth = yearly ? (base * 10) / 12 : base; // yearly = pay 10 months
  return { now: Math.round(perMonth * 0.5), was: base }; // founder 50%
}

export function PricingCards({ currentPlan }: { currentPlan: string }) {
  const [yearly, setYearly] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div className="dim" style={{ letterSpacing: ".1em", textTransform: "uppercase", fontSize: 12 }}>อัปเกรดแผน</div>
        <h1 style={{ margin: "2px 0 6px", fontSize: 30 }}>เลือกแพ็กที่ใช่</h1>
        <p style={{ margin: 0, color: "var(--gold)" }}>🔥 ราคาผู้ก่อตั้ง — รายปีลด 50% · เหลือ 95/100 ที่นั่ง</p>
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "14px 0" }}>
        <button className={`chip${!yearly ? " on" : ""}`} onClick={() => setYearly(false)}>รายเดือน</button>
        <button className={`chip${yearly ? " on" : ""}`} onClick={() => setYearly(true)}>รายปี · 2 เดือนฟรี</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
        <span className="pill" style={{ fontSize: 12 }}>PromptPay · จ่ายครั้งเดียว</span>
        <span className="pill" style={{ fontSize: 12 }}>บัตร · ต่ออัตโนมัติ</span>
      </div>

      {/* Coupon */}
      <div style={{ maxWidth: 420, margin: "12px auto" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="🏷️ มีโค้ดส่วนลด? ใส่ที่นี่" value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button className="btn" onClick={() => setCouponMsg(coupon ? `โค้ด "${coupon}" จะใช้ได้เมื่อระบบชำระเงินเปิด` : null)}>
            ใช้โค้ด
          </button>
        </div>
        {couponMsg && <p className="dim" style={{ marginTop: 6, textAlign: "center" }}>{couponMsg}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 8 }}>
        {PLANS.map((p) => {
          const { now, was } = priceOf(p.base, yearly);
          const isCurrent = p.key === currentPlan;
          return (
            <div key={p.key} className="card" style={{ position: "relative", margin: 0, borderColor: p.recommended ? "var(--accent)" : undefined }}>
              {p.recommended && (
                <span className="pill" style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}>
                  แนะนำ
                </span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                {isCurrent && <span className="pill" style={{ fontSize: 11 }}>แผนปัจจุบัน</span>}
              </div>
              <p className="dim" style={{ margin: "2px 0 12px", fontSize: 13 }}>{p.tagline}</p>

              {p.base === 0 ? (
                <div style={{ fontSize: 32, fontWeight: 800 }}>฿0<span className="dim" style={{ fontSize: 14, fontWeight: 400 }}> หลังทดลอง</span></div>
              ) : (
                <div>
                  <span style={{ fontSize: 34, fontWeight: 800 }}>฿{now}</span>
                  <span className="dim" style={{ fontSize: 14 }}>/เดือน </span>
                  <span className="dim" style={{ textDecoration: "line-through", fontSize: 14 }}>฿{was}</span>
                  <div style={{ color: "var(--gold)", fontSize: 12.5, marginTop: 2 }}>
                    🔥 Founding ลด 50% · {yearly ? "จ่ายปีละครั้ง" : "จ่ายรายเดือน"}
                  </div>
                </div>
              )}

              <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5 }}>
                    <span style={{ color: "var(--success)" }}>✓</span>
                    <span className="dim" style={{ color: "var(--text)" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button className={`btn${p.recommended ? " primary" : ""}`} disabled={isCurrent || p.base === 0}
                title="ต่อระบบชำระเงินในขั้นถัดไป"
                style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
                {isCurrent ? "แผนปัจจุบัน" : p.base === 0 ? "เริ่มฟรี" : "เลือกแพ็กนี้ (เร็วๆ นี้)"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="dim" style={{ marginTop: 18, textAlign: "center" }}>
        💳 ระบบชำระเงิน (บัตร/PromptPay) กำลังจะมา · เครดิต AI เติมแยกได้ที่หน้า Settings → Billing
      </p>
    </div>
  );
}
