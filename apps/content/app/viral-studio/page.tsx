"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type TemplateRow } from "@cs/db";

const CATEGORIES = ["ทั้งหมด", "คลิป 3D", "ภาพไวรัล", "เกาะกระแส", "สินค้าโฆษณา", "เพลง AI"];

export default function ViralStudioPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [cat, setCat] = useState("ทั้งหมด");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const db = browserClient();
    db.from("templates").select("*").eq("kind", "viral").eq("is_published", true)
      .order("usage_count", { ascending: false })
      .then(({ data }) => {
        setTemplates((data ?? []) as TemplateRow[]);
        setLoading(false);
      });
  }, []);

  const filtered = templates.filter((t) => cat === "ทั้งหมด" || t.category === cat);

  return (
    <div>
      <h1>🔥 Viral Studio</h1>
      <p className="dim">เลือกเทรนด์ที่สนใจ กรอกข้อมูลนิดเดียว แล้ว AI จะสร้างให้ครบชุด!</p>

      {!isSupabaseConfigured() && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <p className="dim">ต้องตั้งค่า Supabase ก่อนถึงจะโหลดเทมเพลตได้</p>
        </div>
      )}

      <div className="chip-row">
        {CATEGORIES.map((c) => {
          const n = c === "ทั้งหมด" ? templates.length : templates.filter((t) => t.category === c).length;
          return (
            <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
              {c} ({n})
            </button>
          );
        })}
      </div>

      {loading && <p className="dim">กำลังโหลด…</p>}
      {!loading && filtered.length === 0 && <p className="dim">ยังไม่มีเทมเพลตในหมวดนี้</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {filtered.map((t) => (
          <Link key={t.slug} href={`/viral-studio/${t.slug}`} className="card" style={{ margin: 0, display: "block" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              {t.badges.includes("hot") && <span className="pill" style={{ borderColor: "var(--danger)" }}>🔥 HOT</span>}
              {t.badges.includes("new") && <span className="pill" style={{ borderColor: "var(--accent)" }}>✨ NEW</span>}
              {t.badges.includes("featured") && <span className="pill" style={{ borderColor: "var(--gold)" }}>★ Featured</span>}
            </div>
            <div className="dim" style={{ fontSize: 12 }}>{t.category}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{t.name_th}</div>
            <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>ใช้ {t.usage_count} ครั้ง</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
