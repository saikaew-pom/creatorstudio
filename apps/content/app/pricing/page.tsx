"use client";
// Plans (doc 01 §9). Payment integration (Stripe/Omise PromptPay) is a sensitive
// action needing real keys — the CTA is informational until that's wired.
import { useT, useLang } from "../LangProvider";

const PLANS = [
  { name: "Free", price: "฿0", per: { th: "ตลอดชีพ", en: "forever" }, badge: null, features: [
    { th: "สร้างคอนเทนต์ 30 ครั้ง/วัน", en: "30 content generations/day" },
    { th: "เครดิตรูป 20/เดือน", en: "20 image credits/month" },
    { th: "วิดีโอ 5 นาที/เดือน", en: "5 video minutes/month" },
    { th: "คลิปยาวสุด 3 นาที", en: "Clips up to 3 min" },
  ] },
  { name: "Pro", price: "฿399", per: { th: "/เดือน", en: "/month" }, badge: { th: "ยอดนิยม", en: "Popular" }, features: [
    { th: "สร้างคอนเทนต์ 100 ครั้ง/วัน", en: "100 content generations/day" },
    { th: "เครดิตรูป 50/เดือน", en: "50 image credits/month" },
    { th: "วิดีโอ 80 นาที/เดือน", en: "80 video minutes/month" },
    { th: "คลิปยาวสุด 10 นาที", en: "Clips up to 10 min" },
    { th: "เก็บวิดีโอ 14 วัน", en: "Videos kept 14 days" },
    { th: "ต่อ Agent / MCP ได้", en: "Agent / MCP access" },
  ] },
  { name: "Business", price: "฿990", per: { th: "/เดือน", en: "/month" }, badge: { th: "คุ้มที่สุด", en: "Best value" }, features: [
    { th: "สร้างคอนเทนต์ 300 ครั้ง/วัน", en: "300 content generations/day" },
    { th: "เครดิตรูป 150/เดือน", en: "150 image credits/month" },
    { th: "วิดีโอ 150 นาที/เดือน", en: "150 video minutes/month" },
    { th: "คลิปยาวสุด 10 นาที", en: "Clips up to 10 min" },
    { th: "เก็บวิดีโอ 14 วัน", en: "Videos kept 14 days" },
    { th: "ต่อ Agent / MCP ได้", en: "Agent / MCP access" },
    { th: "Priority support", en: "Priority support" },
  ] },
];

export default function PricingPage() {
  const t = useT();
  const { lang } = useLang();
  return (
    <div>
      <h1>{t("pricing.title")}</h1>
      <p className="dim">{t("pricing.subtitle")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 16 }}>
        {PLANS.map((p) => (
          <div key={p.name} className="card" style={{ borderColor: p.badge ? "var(--accent)" : undefined }}>
            {p.badge && <span className="pill" style={{ borderColor: "var(--accent)" }}>{p.badge[lang]}</span>}
            <h3 style={{ marginTop: p.badge ? 8 : 0 }}>{p.name}</h3>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{p.price}<span className="dim" style={{ fontSize: 14, fontWeight: 400 }}> {p.per[lang]}</span></div>
            <ul className="dim" style={{ lineHeight: 1.9, paddingLeft: 18, marginTop: 10 }}>
              {p.features.map((f) => <li key={f.th}>{f[lang]}</li>)}
            </ul>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              disabled={p.name === "Free"} title="ต่อระบบชำระเงินในขั้นถัดไป">
              {p.name === "Free" ? t("pricing.current_plan") : t("pricing.upgrade_soon")}
            </button>
          </div>
        ))}
      </div>
      <p className="dim" style={{ marginTop: 16 }}>{t("pricing.payment_note")}</p>
    </div>
  );
}
