"use client";
import type { TaskRow, TaskStatus } from "@cs/db";
import type { TaskViewProps } from "./BoardShell";

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--text-dim)", in_progress: "var(--accent-2)", blocked: "var(--warn)", done: "var(--success)",
};

const DAY_MS = 86_400_000;
const LABEL_WIDTH = 210;
const PAD_DAYS = 2;
const TICK_COUNT = 6;

// "YYYY-MM-DD" + T00:00:00 parses as local midnight — bare `new Date("YYYY-MM-DD")`
// parses as UTC midnight and shifts a day in negative-offset timezones (see
// packages/db/migrations/0011_security_hardening.sql header for the same bug class).
function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatTick(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type PlottableTask = TaskRow & { start_date: string; due_date: string };

export function GanttView({ tasks, onOpenTask }: TaskViewProps) {
  const plottable = tasks.filter((t): t is PlottableTask => Boolean(t.start_date && t.due_date));
  const unscheduled = tasks.filter((t) => !t.start_date || !t.due_date);

  if (plottable.length === 0) {
    return (
      <div>
        <div className="empty-state">
          <div className="icon">📊</div>
          <p>ยังไม่มีงานที่กำหนดทั้งวันเริ่มและวันครบกำหนด ไว้ลงตารางเวลา</p>
        </div>
        {unscheduled.length > 0 && <UnscheduledList tasks={unscheduled} onOpenTask={onOpenTask} />}
      </div>
    );
  }

  const minStart = new Date(Math.min(...plottable.map((t) => parseDate(t.start_date).getTime())));
  const maxDue = new Date(Math.max(...plottable.map((t) => parseDate(t.due_date).getTime())));
  const rangeStart = new Date(minStart.getTime() - PAD_DAYS * DAY_MS);
  const rangeEnd = new Date(maxDue.getTime() + PAD_DAYS * DAY_MS);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const offsetDays = Math.round((totalDays * i) / TICK_COUNT);
    return {
      pct: (offsetDays / totalDays) * 100,
      label: formatTick(new Date(rangeStart.getTime() + offsetDays * DAY_MS)),
    };
  });

  return (
    <div>
      <div className="card" style={{ padding: "14px 16px", overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: 560 }}>
          <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
          <div style={{ flex: 1, position: "relative", height: 20, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
            {ticks.map((tk, i) => (
              <span key={i} className="dim" style={{
                position: "absolute", left: `${tk.pct}%`, fontSize: 11,
                transform: i === 0 ? undefined : i === TICK_COUNT ? "translateX(-100%)" : "translateX(-50%)",
              }}>
                {tk.label}
              </span>
            ))}
          </div>
        </div>

        {plottable.map((t) => {
          const start = parseDate(t.start_date);
          const due = parseDate(t.due_date);
          const leftPct = (daysBetween(rangeStart, start) / totalDays) * 100;
          const widthPct = (Math.max(0, daysBetween(start, due)) / totalDays) * 100;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", minWidth: 560 }}>
              <div className="dim" style={{
                width: LABEL_WIDTH, flexShrink: 0, paddingRight: 10, fontSize: 13, color: "var(--text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }} title={t.title}>
                {t.title}
              </div>
              <div style={{ flex: 1, position: "relative", height: 30 }}>
                <div
                  onClick={() => onOpenTask(t)}
                  title={`${t.start_date} → ${t.due_date}`}
                  style={{
                    position: "absolute", top: 6, height: 18, borderRadius: 4, cursor: "pointer",
                    left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 8,
                    background: STATUS_COLOR[t.status],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && <UnscheduledList tasks={unscheduled} onOpenTask={onOpenTask} />}
    </div>
  );
}

function UnscheduledList({ tasks, onOpenTask }: { tasks: TaskRow[]; onOpenTask: (task: TaskRow) => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="label">ไม่มีกำหนดการ</div>
      {tasks.map((t) => (
        <div key={t.id} className="card" style={{ padding: 10, margin: "0 0 8px", cursor: "pointer" }} onClick={() => onOpenTask(t)}>
          <span style={{ fontSize: 13.5 }}>{t.title}</span>
        </div>
      ))}
    </div>
  );
}
