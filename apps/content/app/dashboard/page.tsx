"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const [topic, setTopic] = useState("");
  const router = useRouter();
  return (
    <div>
      <div className="topbar">
        <span className="pill">✏️ ไม่ตั้งแบรนด์</span>
        <span className="pill">✨ Gemini 2.5 Flash · ฟรี</span>
        <span className="pill">🔥 สตรีคเริ่มวันนี้</span>
      </div>
      <h1 style={{ marginBottom: 4 }}>สวัสดี 👋</h1>
      <p className="dim">พร้อมสร้าง content วันนี้แล้วหรือยัง?</p>

      <div className="card">
        <h3>🚀 เริ่มสร้าง Content</h3>
        <p className="dim" style={{ marginTop: 0 }}>พิมพ์หัวข้อหรือสินค้า แล้วให้ AI สร้างให้ครบ</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            placeholder='เช่น "ครีมกันแดดสำหรับผิวมัน" หรือ "ร้านกาแฟเปิดใหม่"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && topic.trim())
                router.push(`/studio?topic=${encodeURIComponent(topic)}`);
            }}
          />
          <button
            className="btn primary"
            disabled={!topic.trim()}
            onClick={() => router.push(`/studio?topic=${encodeURIComponent(topic)}`)}
          >
            {topic.trim() ? "สร้างเลย 🚀" : "พิมพ์หัวข้อก่อน ✏️"}
          </button>
        </div>
        <div className="chip-row" style={{ marginTop: 12 }}>
          <span className="dim">หรือ:</span>
          <Link href="/viral-studio" className="chip">🔥 เทรนด์ไวรัล</Link>
          <Link href="/studio" className="chip">💡 หาไอเดียก่อน</Link>
          <Link href="/brands" className="chip">✨ ตั้ง Brand</Link>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>เริ่มต้นใช้งาน</h3>
          <div className="dim">
            <div>◻ สร้างคอนเทนต์แรก</div>
            <div>◻ ให้ AI ช่วยคิดไอเดีย</div>
            <div>◻ ลอง Viral Studio</div>
            <div>◻ ตั้ง Brand Voice</div>
          </div>
        </div>
        <div className="card">
          <h3>ล็อกเสียงแบรนด์ให้คอนเทนต์นิ่งขึ้น</h3>
          <p className="dim">เหมาะกับคนที่สร้าง Studio หลายงานแล้ว</p>
          <Link href="/brands" className="btn sm">ตั้ง Brand Voice →</Link>
        </div>
      </div>
    </div>
  );
}
