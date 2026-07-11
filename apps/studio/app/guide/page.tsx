import Link from "next/link";

const STEPS = [
  { n: "1", t: "เขียน/วางสคริปต์", s: "พิมพ์สคริปต์ไทย 1 บรรทัด = 1 ประโยค · บรรทัดแรกคือ Hook · ระบบตัดเป็นเซ็กเมนต์ให้อัตโนมัติ" },
  { n: "2", t: "เลือกองค์ประกอบ", s: "เสียงพากย์ (MiniMax เสียงไทยธรรมชาติ) · เพลงประกอบ(ลดเสียงใต้เสียงพูดอัตโนมัติ) · B-roll (AI หรือสต็อกฟรี)" },
  { n: "3", t: "เรนเดอร์เบื้องหลัง", s: "งานเข้าคิว worker ประมวลผล (TTS → B-roll → ประกอบวิดีโอ) · ใช้เวลาไม่กี่นาที · ปิดแท็บได้" },
  { n: "4", t: "แต่งซับ", s: "ปรับสไตล์/สี/ตำแหน่งซับ · เลือกความยาวการ์ด (1 ประโยค → คาราโอเกะทีละคำ) · แก้แล้วเห็นผลทันที ไม่ต้องเรนเดอร์ใหม่" },
  { n: "5", t: "ส่งออก", s: "เบิร์นซับลงวิดีโอ (ฟอนต์ไทย Kanit) → ดาวน์โหลด mp4 9:16 พร้อมโพสต์ TikTok/Reels/Shorts" },
];

const FAQ = [
  { q: "ต้องมี API key ของตัวเองไหม?", a: "ไม่ต้อง — Gemini (รูป/สคริปต์) และ MiniMax (เสียงไทย) จัดการให้แล้ว · ใส่แค่ Pexels/Pixabay เองถ้าอยากใช้ B-roll สต็อกฟรี (ที่ Settings → API Keys)" },
  { q: "โควตานาทีคิดยังไง?", a: "คิดตามความยาววิดีโอที่เรนเดอร์จริง (ปัดขึ้นเป็นนาที) · รีเซ็ตทุกต้นเดือน · ใช้เกินเติมเครดิตได้ (2 เครดิต = 1 นาที)" },
  { q: "สั่งสร้างผ่าน Claude/agent ได้ไหม?", a: "ได้ — ต่อผ่าน MCP ที่ Settings → Agent/MCP แล้วสั่งสร้างวิดีโอด้วยภาษาพูด" },
];

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 820 }}>
      <h1>วิธีใช้งาน</h1>
      <p className="dim">สร้างวิดีโอ faceless ภาษาไทยด้วย AI — สคริปต์ → เสียง → B-roll → ซับ → ส่งออก · ครบใน 5 ขั้นตอน</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>5 ขั้นตอนสร้างวิดีโอ</h3>
        {STEPS.map((s) => (
          <div key={s.n} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{s.n}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{s.t}</div>
              <div className="dim" style={{ fontSize: 13.5 }}>{s.s}</div>
            </div>
          </div>
        ))}
        <Link href="/video-editor" className="btn primary" style={{ marginTop: 14 }}>🎬 เริ่มสร้างวิดีโอ →</Link>
      </div>

      <div className="card">
        <h3>คำถามที่พบบ่อย</h3>
        {FAQ.map((f) => (
          <div key={f.q} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600 }}>{f.q}</div>
            <div className="dim" style={{ fontSize: 13.5 }}>{f.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
