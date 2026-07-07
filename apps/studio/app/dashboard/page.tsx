import Link from "next/link";

export default function Dashboard() {
  return (
    <div>
      <h1>🎬 Creator Studio</h1>
      <p className="dim">เริ่มสร้างเนื้อหาวิดีโอด้วย AI — เลือก action ด้านล่างเพื่อเริ่ม</p>
      <div className="card">
        <h3>วิธีใช้งาน</h3>
        <ul className="dim">
          <li>สคริปต์ → องค์ประกอบ (เสียง/เพลง/บีโรล) → เรนเดอร์เบื้องหลัง → แต่งซับ → ส่งออก</li>
          <li>ระบบจัดการ AI (Gemini) ให้ — ใส่แค่ Pexels/Pixabay สำหรับ B-roll</li>
        </ul>
      </div>
      <div className="grid2">
        <Link href="/video-editor" className="card" style={{ display: "block" }}>
          <h3>🎬 Video Editor →</h3>
          <p className="dim">Timeline editor</p>
        </Link>
        <div className="card">
          <h3>📼 Gallery</h3>
          <p className="dim">ดู renders เก่า — ต้องต่อ Supabase ก่อน (M1)</p>
        </div>
      </div>
    </div>
  );
}
