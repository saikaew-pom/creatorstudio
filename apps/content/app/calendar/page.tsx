"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured, type GenerationRow } from "@cs/db";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_DOW = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];

function toBuddhistYear(y: number): number {
  return y + 543;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [rows, setRows] = useState<GenerationRow[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    const db = browserClient();
    const { data } = await db.auth.getUser();
    if (!data.user) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const { data: gens } = await db
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((gens ?? []) as GenerationRow[]);
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignedIn(false);
      return;
    }
    load();
  }, []);

  async function assignDate(genId: string, date: string | null) {
    const db = browserClient();
    await db.from("generations").update({ scheduled_date: date }).eq("id", genId);
    setRows((prev) => prev.map((r) => (r.id === genId ? { ...r, scheduled_date: date } : r)));
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const unscheduled = rows.filter((r) => !r.scheduled_date);
  const byDate: Record<string, GenerationRow[]> = {};
  for (const r of rows) if (r.scheduled_date) (byDate[r.scheduled_date] ??= []).push(r);

  return (
    <div>
      <h1>📅 Content Calendar</h1>
      <p className="dim">จัดตาราง content รายเดือน — ลาก content จากรายการด้านล่างมาวางบนวันที่ต้องการ</p>

      {signedIn === false && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>{isSupabaseConfigured() ? "ยังไม่ได้เข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</b>
          {isSupabaseConfigured() && <div><Link href="/login?next=/calendar" className="btn primary" style={{ marginTop: 8 }}>เข้าสู่ระบบ</Link></div>}
        </div>
      )}

      {signedIn && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button className="btn sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
            <b>{THAI_MONTHS[month]} {toBuddhistYear(year)}</b>
            <button className="btn sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16 }}>
            {THAI_DOW.map((d) => <div key={d} className="dim" style={{ textAlign: "center", fontSize: 12 }}>{d}</div>)}
            {cells.map((day, i) => {
              const dateStr = day ? ymd(new Date(year, month, day)) : null;
              const items = dateStr ? byDate[dateStr] ?? [] : [];
              return (
                <div key={i}
                  onDragOver={(e) => day && e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (day && dragId) assignDate(dragId, dateStr); }}
                  style={{
                    minHeight: 84, borderRadius: 8, border: "1px solid var(--border)",
                    background: day ? "var(--bg-raised)" : "transparent", padding: 6, fontSize: 11,
                  }}
                >
                  {day && <div className="dim">{day}</div>}
                  {items.map((it) => (
                    <div key={it.id} draggable onDragStart={() => setDragId(it.id)}
                      style={{ background: "var(--bg-inset)", borderRadius: 6, padding: "3px 6px", marginTop: 3, cursor: "grab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={it.title ?? ""}>
                      {it.type === "image" ? "🖼" : "✏️"} {it.title ?? "(ไม่มีชื่อ)"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <h3>ยังไม่ได้กำหนดวัน ({unscheduled.length})</h3>
          <p className="dim">ลากรายการเหล่านี้ไปวางบนปฏิทินด้านบน</p>
          <div className="chip-row">
            {unscheduled.map((r) => (
              <div key={r.id} draggable onDragStart={() => setDragId(r.id)}
                className="chip" style={{ cursor: "grab" }}>
                {r.type === "image" ? "🖼" : "✏️"} {r.title ?? "(ไม่มีชื่อ)"}
              </div>
            ))}
            {unscheduled.length === 0 && <p className="dim">ไม่มีรายการที่ยังไม่ได้กำหนดวัน</p>}
          </div>
        </>
      )}
    </div>
  );
}
