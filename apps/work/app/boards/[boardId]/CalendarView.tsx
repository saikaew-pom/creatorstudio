"use client";
import { useState } from "react";
import type { TaskRow } from "@cs/db";
import type { TaskViewProps } from "./BoardShell";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_DOW = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];

function toBuddhistYear(y: number): number {
  return y + 543;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Calendar view — placed by due_date, drag-to-date via the same plain-HTML5-DnD
// technique as apps/content's calendar (no DnD library, no shared UI package
// between the two Next.js apps, so the month-grid helpers are reimplemented here).
export function CalendarView({ tasks, onOpenTask, onTaskUpdated, reload }: TaskViewProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function assignDate(taskId: string, date: string | null) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: date }),
      });
      if (res.ok) {
        onTaskUpdated(taskId, { due_date: date });
      } else {
        // e.g. the new due_date would land before the task's own start_date —
        // the drag already "landed" visually, so without this the task
        // silently stays put with zero feedback. reload() re-syncs the real
        // due_date from the server (the drag itself never optimistically
        // moved local state, but this keeps the recovery path identical to
        // BoardView's).
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "ย้ายวันที่ไม่สำเร็จ");
        reload();
      }
    } finally {
      setBusy(false);
      setDragId(null);
    }
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const unscheduled = tasks.filter((t) => !t.due_date);
  const byDate: Record<string, TaskRow[]> = {};
  for (const t of tasks) if (t.due_date) (byDate[t.due_date] ??= []).push(t);

  return (
    <div>
      {err && <p style={{ color: "var(--danger)", marginBottom: 8 }}>{err}</p>}
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
              {items.map((t) => (
                <div key={t.id} draggable={!busy}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpenTask(t)}
                  style={{
                    background: "var(--bg-inset)", borderRadius: 6, padding: "3px 6px", marginTop: 3,
                    cursor: busy ? "wait" : "grab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  title={t.title}
                >
                  {t.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <h3>ยังไม่กำหนดวัน ({unscheduled.length})</h3>
      <p className="dim">ลากงานเหล่านี้ไปวางบนปฏิทินด้านบน</p>
      <div className="chip-row">
        {unscheduled.map((t) => (
          <div key={t.id} draggable={!busy}
            onDragStart={() => setDragId(t.id)}
            onDragEnd={() => setDragId(null)}
            onClick={() => onOpenTask(t)}
            className="chip" style={{ cursor: busy ? "wait" : "grab" }}>
            {t.title}
          </div>
        ))}
        {unscheduled.length === 0 && <p className="dim">ไม่มีงานที่ยังไม่กำหนดวัน</p>}
      </div>
    </div>
  );
}
