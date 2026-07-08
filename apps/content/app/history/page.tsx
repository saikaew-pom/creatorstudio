"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type GenerationRow } from "@cs/db";

type Filter = "all" | "image" | "content_kit";

function thDate(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const [rows, setRows] = useState<GenerationRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    const db = browserClient();
    db.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const { data: gens } = await db
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      const list = (gens ?? []) as GenerationRow[];
      setRows(list);
      const u: Record<string, string> = {};
      for (const g of list) {
        if (g.type === "image" && g.asset_path) {
          u[g.id] = db.storage.from("generations").getPublicUrl(g.asset_path).data.publicUrl;
        }
      }
      setUrls(u);
      setLoading(false);
    });
  }, []);

  async function regenerate(g: GenerationRow) {
    if (!g.prompt_rendered) return;
    setRegenerating(g.id);
    try {
      const input = g.input as { thai_text_mode?: boolean; aspect?: string };
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: g.prompt_rendered,
          aspect: input.aspect ?? "1:1",
          thai_text_mode: input.thai_text_mode ?? false,
          skip_enhance: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Reflect the freshly generated image immediately without a full reload.
        setUrls((prev) => ({ ...prev, [g.id]: data.url }));
      }
    } finally {
      setRegenerating(null);
    }
  }

  const filtered = rows.filter((r) => filter === "all" || r.type === filter);

  return (
    <div>
      <h1>ผลงานของฉัน</h1>
      <p className="dim">ทุกอย่างที่คุณสร้างไว้ — ภาพ · เนื้อหา · เทรนด์</p>

      {signedIn === false && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>{isSupabaseConfigured() ? "ยังไม่ได้เข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</b>
          {isSupabaseConfigured() && <div><Link href="/login?next=/history" className="btn primary" style={{ marginTop: 8 }}>เข้าสู่ระบบ</Link></div>}
        </div>
      )}

      {signedIn && (
        <>
          <div className="chip-row">
            <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>ทั้งหมด</button>
            <button className={`chip ${filter === "image" ? "on" : ""}`} onClick={() => setFilter("image")}>🖼 Visual</button>
            <button className={`chip ${filter === "content_kit" ? "on" : ""}`} onClick={() => setFilter("content_kit")}>✏️ Content</button>
          </div>

          {loading && <p className="dim">กำลังโหลด…</p>}
          {!loading && filtered.length === 0 && <p className="dim">ยังไม่มีผลงาน — ลองสร้างที่ Content Studio หรือ Visual Studio ดูสิ</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {filtered.map((g) => (
              <div key={g.id} className="card" style={{ margin: 0 }}>
                <span className="pill">{g.type === "image" ? "🖼 Visual" : "✏️ Content"}</span>
                {g.type === "image" && urls[g.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[g.id]} alt={g.title ?? ""} style={{ width: "100%", borderRadius: 10, marginTop: 8, display: "block" }} />
                )}
                <div style={{ marginTop: 8, fontWeight: 600, fontSize: 14 }}>{g.title ?? "(ไม่มีชื่อ)"}</div>
                <div className="dim" style={{ fontSize: 12 }}>{g.niche ?? "ทั่วไป"} · {thDate(g.created_at)}</div>
                {g.type === "image" && (
                  <button className="btn sm" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                    disabled={regenerating === g.id} onClick={() => regenerate(g)}>
                    {regenerating === g.id ? <span className="spin" /> : "🔄 เจนใหม่ (ใช้ prompt เดิม)"}
                  </button>
                )}
                {g.type === "content_kit" && (
                  <Link href={`/studio?topic=${encodeURIComponent(g.title ?? "")}`} className="btn sm" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
                    เปิดดู →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
