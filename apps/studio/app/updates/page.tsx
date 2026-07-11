const RELEASES = [
  { v: "v1.3", date: "2026-07-11", tag: "ใหม่", items: [
    "ซับคาราโอเกะ — ตัดการ์ดซับทีละคำ/วลี (1 ประโยค → 1 คำ) แบบ TikTok",
    "ไทม์ไลน์แบบหลายแทร็ก (เสียงพูด · B-roll · ซับ · เพลง) พร้อม waveform",
    "แก้ซับเห็นผลทันที ไม่ต้องเรนเดอร์ใหม่",
  ] },
  { v: "v1.2", date: "2026-07-11", tag: null, items: [
    "เสียงพากย์ MiniMax — เสียงไทยธรรมชาติเป็นค่าเริ่มต้น (แก้ปัญหา Gemini ปฏิเสธประโยคสั้น)",
    "ฟอนต์ไทย Kanit/Sarabun ในซับที่ส่งออก (แก้ตัวอักษรกล่อง □)",
    "หน้า Pricing · Settings (Profile/API Keys/MCP/Billing) · Gallery",
  ] },
  { v: "v1.1", date: "2026-07-10", tag: null, items: [
    "อัปโหลดคลิปเอง → ถอดเสียง + ใส่ซับอัตโนมัติ",
    "ต่อ Agent / MCP — สั่งสร้างวิดีโอผ่าน Claude ด้วยภาษาพูด",
  ] },
  { v: "v1.0", date: "2026-07-09", tag: null, items: [
    "เปิดตัว Creator Studio — สคริปต์ → เสียง → B-roll → ซับ → ส่งออก 9:16",
  ] },
];

export default function UpdatesPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <h1>อัปเดต</h1>
      <p className="dim">ฟีเจอร์ใหม่และการแก้ไขล่าสุดของ Creator Studio</p>
      <div style={{ marginTop: 16 }}>
        {RELEASES.map((r) => (
          <div key={r.v} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{r.v}</h3>
              {r.tag && <span className="pill" style={{ borderColor: "var(--accent)", color: "var(--accent-2)" }}>{r.tag}</span>}
              <span className="dim" style={{ fontSize: 12, marginLeft: "auto" }}>{new Date(r.date).toLocaleDateString("th-TH")}</span>
            </div>
            <ul className="dim" style={{ lineHeight: 1.9, paddingLeft: 18, margin: "8px 0 0" }}>
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
