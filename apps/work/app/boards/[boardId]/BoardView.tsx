"use client";
import { useState } from "react";
import type { TaskRow, TaskStatus } from "@cs/db";
import { PriorityChip, STATUS_LABEL, STATUS_ORDER } from "../chips";
import type { TaskViewProps } from "./BoardShell";

// Kanban view — plain HTML5 drag-and-drop (draggable/onDragStart/onDragOver/onDrop),
// same technique as apps/content's calendar drag (no DnD library in this codebase).
// Dropping ON a card places the dragged task immediately BEFORE it in that
// column; dropping on the column body (below the last card) appends to the end.
export function BoardView({ tasks, onOpenTask, onTaskUpdated, reload }: TaskViewProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byStatus: Record<TaskStatus, TaskRow[]> = {
    todo: [], in_progress: [], blocked: [], done: [],
  };
  for (const t of tasks) byStatus[t.status].push(t);
  for (const s of STATUS_ORDER) byStatus[s].sort((a, b) => a.position - b.position);

  async function moveTo(status: TaskStatus, prevId: string | null, nextId: string | null) {
    if (!dragId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${dragId}/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, prevId, nextId }),
      });
      const json = await res.json();
      if (res.ok) {
        onTaskUpdated(dragId, { status, position: json.position });
      } else {
        // The card already visually "dropped" via HTML5 DnD before this
        // request resolved — on failure it must snap back to its real
        // position, not sit wherever the browser left it. reload() re-fetches
        // the board's actual state (same recovery `err` needs anyway).
        setErr(json.error ?? "ย้ายงานไม่สำเร็จ");
        reload();
      }
    } finally {
      setBusy(false);
      setDragId(null);
    }
  }

  return (
    <div>
      {err && <p style={{ color: "var(--danger)", marginBottom: 8 }}>{err}</p>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATUS_ORDER.length}, 1fr)`, gap: 12 }}>
      {STATUS_ORDER.map((status) => {
        const list = byStatus[status];
        return (
          <div key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              moveTo(status, list.length ? list[list.length - 1].id : null, null);
            }}
            style={{ background: "var(--bg-inset)", borderRadius: 10, padding: 10, minHeight: 220 }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span>{STATUS_LABEL[status]}</span>
              <span className="dim">{list.length}</span>
            </div>
            {list.map((t, i) => (
              <div key={t.id} draggable={!busy}
                onDragStart={() => setDragId(t.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  moveTo(status, i > 0 ? list[i - 1].id : null, t.id);
                }}
                onClick={() => onOpenTask(t)}
                className="card"
                style={{ margin: "0 0 8px", padding: 10, cursor: busy ? "wait" : "grab" }}
              >
                <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 13.5 }}>{t.title}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <PriorityChip priority={t.priority} />
                  {t.assignee_name && <span className="dim" style={{ fontSize: 11 }}>{t.assignee_name}</span>}
                  {t.due_date && <span className="dim" style={{ fontSize: 11 }}>📅 {t.due_date}</span>}
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="dim" style={{ fontSize: 12 }}>ลากงานมาวางที่นี่</p>}
          </div>
        );
      })}
      </div>
    </div>
  );
}
