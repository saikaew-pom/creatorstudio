// Plans (doc 01 §9). Payment integration (Stripe/Omise PromptPay) is a sensitive
// action needing real keys — the CTA is informational until that's wired.
const PLANS = [
  { name: "Free", price: "฿0", per: "ตลอดชีพ", badge: null, features: [
    "สร้างคอนเทนต์ 30 ครั้ง/วัน", "เครดิตรูป 20/เดือน", "วิดีโอ 5 นาที/เดือน", "คลิปยาวสุด 3 นาที",
  ] },
  { name: "Pro", price: "฿399", per: "/เดือน", badge: "ยอดนิยม", features: [
    "สร้างคอนเทนต์ 100 ครั้ง/วัน", "เครดิตรูป 50/เดือน", "วิดีโอ 80 นาที/เดือน", "คลิปยาวสุด 10 นาที",
    "เก็บวิดีโอ 14 วัน", "ต่อ Agent / MCP ได้",
  ] },
  { name: "Business", price: "฿990", per: "/เดือน", badge: "คุ้มที่สุด", features: [
    "สร้างคอนเทนต์ 300 ครั้ง/วัน", "เครดิตรูป 150/เดือน", "วิดีโอ 150 นาที/เดือน", "คลิปยาวสุด 10 นาที",
    "เก็บวิดีโอ 14 วัน", "ต่อ Agent / MCP ได้", "Priority support",
  ] },
];

export default function PricingPage() {
  return (
    <div>
      <h1>แพ็กเกจ</h1>
      <p className="dim">เริ่มฟรี อัปเกรดเมื่อพร้อม · ยกเลิกได้ทุกเมื่อ</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 16 }}>
        {PLANS.map((p) => (
          <div key={p.name} className="card" style={{ borderColor: p.badge === "ยอดนิยม" ? "var(--accent)" : undefined }}>
            {p.badge && <span className="pill" style={{ borderColor: "var(--accent)" }}>{p.badge}</span>}
            <h3 style={{ marginTop: p.badge ? 8 : 0 }}>{p.name}</h3>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{p.price}<span className="dim" style={{ fontSize: 14, fontWeight: 400 }}> {p.per}</span></div>
            <ul className="dim" style={{ lineHeight: 1.9, paddingLeft: 18, marginTop: 10 }}>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              disabled={p.name === "Free"} title="ต่อระบบชำระเงินในขั้นถัดไป">
              {p.name === "Free" ? "แผนปัจจุบัน" : "อัปเกรด (เร็วๆ นี้)"}
            </button>
          </div>
        ))}
      </div>
      <p className="dim" style={{ marginTop: 16 }}>💳 ระบบชำระเงิน (บัตร/PromptPay) กำลังจะมา · เติมเครดิต AI แยกได้ที่หน้า เครดิต</p>
    </div>
  );
}
