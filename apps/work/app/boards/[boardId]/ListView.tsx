"use client";
import { useState } from "react";
import type { TaskRow, TaskStatus } from "@cs/db";
import { PriorityChip, STATUS_LABEL, STATUS_ORDER } from "../chips";
import type { TaskViewProps } from "./BoardShell";
import { todayIsoBangkok } from "../../../lib/dates";

// List view — grouped by status (docs/07 §2). Inline edit: status moves through
// the reorder_task RPC since PATCH /api/tasks/[id] doesn't accept a bare "status"
// field — only the reorder RPC does the advisory-locked position math for a
// status change. reorder_task's null/null case is "fixed position 1000", NOT
// "append after the last task" — so to actually append, pass the target column's
// current last task as prevId (matching BoardView.tsx's column-body-drop
// convention); passing null/null here would collide every list-driven status
// change onto the same position=1000 as fresh tasks and any other list-driven move.
export function ListView({ tasks, onOpenTask, onTaskUpdated }: TaskViewProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byStatus: Record<TaskStatus, TaskRow[]> = {
    todo: [], in_progress: [], blocked: [], done: [],
  };
  for (const t of tasks) byStatus[t.status].push(t);
  for (const s of STATUS_ORDER) byStatus[s].sort((a, b) => a.position - b.position);

  async function changeStatus(task: TaskRow, status: TaskStatus) {
    if (status === task.status) return;
    setSavingId(task.id);
    setErr(null);
    try {
      const targetColumn = byStatus[status];
      const lastInTarget = targetColumn.length ? targetColumn[targetColumn.length - 1].id : null;
      const res = await fetch(`/api/tasks/${task.id}/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, prevId: lastInTarget, nextId: null }),
      });
      const json = await res.json();
      // On failure the <select> is still bound to `value={task.status}` (the
      // parent's unchanged state), so it snaps back to the real value on its
      // own — but silently, with no indication of WHY the change didn't
      // stick, unless the error is actually surfaced here.
      if (res.ok) onTaskUpdated(task.id, { status, position: json.position });
      else setErr(json.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  // Compares calendar-date strings directly rather than parsing due_date into a
  // Date and comparing to `new Date()` — a bare "YYYY-MM-DD" parses as UTC
  // midnight (ECMA-262), which would mark a task due "today" as overdue for
  // ~17 hours of the day in Bangkok (UTC+7). This also means a task isn't
  // "overdue" until the day AFTER it's due, not from some hour of the due day.
  function isOverdue(t: TaskRow): boolean {
    if (!t.due_date || t.status === "done") return false;
    return t.due_date < todayIsoBangkok();
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">▦</div>
        <p>ยังไม่มีงานในบอร์ดนี้ — เพิ่มงานแรกด้านบน</p>
      </div>
    );
  }

  return (
    <div>
      {err && <p style={{ color: "var(--danger)", marginBottom: 8 }}>{err}</p>}
      {STATUS_ORDER.map((status) => {
        const list = byStatus[status];
        return (
          <div key={status} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{STATUS_LABEL[status]}</h3>
              <span className="dim">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="dim" style={{ fontSize: 12.5 }}>ไม่มีงานในสถานะนี้</p>
            ) : (
              <table className="row-table">
                <thead>
                  <tr>
                    <th>งาน</th>
                    <th>สถานะ</th>
                    <th>ความสำคัญ</th>
                    <th>ผู้รับผิดชอบ</th>
                    <th>กำหนดส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span
                          onClick={() => onOpenTask(t)}
                          style={{ color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}
                        >
                          {t.title}
                        </span>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ width: "auto", padding: "4px 8px", fontSize: 12.5 }}
                          value={t.status}
                          disabled={savingId === t.id}
                          onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td><PriorityChip priority={t.priority} /></td>
                      <td>
                        {t.assignee_name ? t.assignee_name : <span className="dim">ไม่มีผู้รับผิดชอบ</span>}
                      </td>
                      <td>
                        {t.due_date ? (
                          <span style={isOverdue(t) ? { color: "var(--danger)" } : undefined}>
                            {new Date(t.due_date).toLocaleDateString("th-TH")}
                          </span>
                        ) : (
                          <span className="dim">ไม่มีกำหนดส่ง</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
