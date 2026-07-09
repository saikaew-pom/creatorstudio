"use client";
import { useEffect, useState } from "react";
import { browserClient, isSupabaseConfigured } from "@cs/db";

interface InspoRow {
  id: string; title: string; author_name: string | null; category: string | null;
  asset_path: string | null; prompt_public: string | null; meta: Record<string, unknown>;
}

function copy(t: string) { void navigator.clipboard.writeText(t); }

export default function InspirationPage() {
  const [items, setItems] = useState<InspoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    browserClient().from("inspiration_items").select("*").order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { setItems((data ?? []) as InspoRow[]); setLoading(false); });
  }, []);

  return (
    <div>
      <h1>✨ Inspiration</h1>
      <p className="dim">แรงบันดาลใจจากผลงานจริง พร้อม prompt ที่ใช้ — กดคัดลอกไปปรับเป็นของคุณได้เลย</p>

      {loading && <p className="dim">กำลังโหลด…</p>}
      {!loading && items.length === 0 && (
        <div className="card"><p className="dim">ยังไม่มีผลงานแนะนำ — แอดมินจะคัดผลงานเด่นมาโชว์ที่นี่ (พร้อม prompt ให้ก๊อปไปใช้)</p></div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {items.map((it) => (
          <div key={it.id} className="card" style={{ margin: 0 }}>
            {it.category && <span className="pill" style={{ fontSize: 11 }}>{it.category}</span>}
            <div style={{ fontWeight: 700, marginTop: 6 }}>{it.title}</div>
            {it.author_name && <div className="dim" style={{ fontSize: 12 }}>โดย {it.author_name}</div>}
            {it.prompt_public && (
              <>
                <div className="prompt-box" style={{ marginTop: 8, maxHeight: 120, overflow: "auto", fontSize: 12 }}>{it.prompt_public}</div>
                <button className="btn sm" style={{ marginTop: 6 }} onClick={() => copy(it.prompt_public!)}>📋 คัดลอก Prompt</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
