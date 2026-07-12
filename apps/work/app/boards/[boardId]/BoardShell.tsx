"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BoardRow, BoardView as BoardViewType, MemberRow, TaskRow } from "@cs/db";
import { TaskDetailPanel } from "../TaskDetailPanel";
import { BoardView } from "./BoardView";
import { ListView } from "./ListView";
import { CalendarView } from "./CalendarView";
import { GanttView } from "./GanttView";

const TABS: { key: BoardViewType; label: string }[] = [
  { key: "list", label: "รายการ" },
  { key: "board", label: "บอร์ด" },
  { key: "calendar", label: "ปฏิทิน" },
  { key: "gantt", label: "แกนต์" },
];

export interface TaskViewProps {
  tasks: TaskRow[];
  members: MemberRow[];
  onOpenTask: (task: TaskRow) => void;
  onTaskUpdated: (taskId: string, patch: Partial<TaskRow>) => void;
  reload: () => void;
}

export function BoardShell({
  board, initialTasks, members,
}: { board: BoardRow; initialTasks: TaskRow[]; members: MemberRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as BoardViewType) || board.default_view;

  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  function setView(v: BoardViewType) {
    router.replace(`/boards/${board.id}?view=${v}`);
  }

  async function reload() {
    const res = await fetch(`/api/boards/${board.id}/tasks`);
    const json = await res.json();
    setTasks(json.tasks ?? []);
  }

  function handleTaskUpdated(taskId: string, patch: Partial<TaskRow>) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, ...patch } : prev));
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setTasks((prev) => [...prev, json.task]);
        setNewTitle("");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleTaskDeleted() {
    if (!selectedTask) return;
    setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
    setSelectedTask(null);
  }

  const viewProps: TaskViewProps = {
    tasks, members, onOpenTask: setSelectedTask, onTaskUpdated: handleTaskUpdated, reload,
  };

  return (
    <div>
      <h1>{board.name}</h1>

      <div className="tabs" style={{ marginTop: 10 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab${view === t.key ? " on" : ""}`} onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
        <input className="input" placeholder="+ เพิ่มงานใหม่…" value={newTitle} disabled={busy}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createTask()} />
        <button className="btn primary" disabled={busy || !newTitle.trim()} onClick={createTask}>เพิ่ม</button>
      </div>

      {view === "list" && <ListView {...viewProps} />}
      {view === "board" && <BoardView {...viewProps} />}
      {view === "calendar" && <CalendarView {...viewProps} />}
      {view === "gantt" && <GanttView {...viewProps} />}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdated={(patch) => handleTaskUpdated(selectedTask.id, patch)}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
