"use client";
import { useEffect, useState } from "react";
import type { ActivityRow, CommentRow, MemberRow, TaskPriority, TaskRow, TaskStatus } from "@cs/db";
import { AssigneePicker } from "./AssigneePicker";
import { PRIORITY_LABEL, STATUS_LABEL } from "./chips";

function statusLabel(s: unknown): string {
  return STATUS_LABEL[s as TaskStatus] ?? String(s);
}

const ACTIVITY_LABEL: Record<string, (d: Record<string, unknown>) => string> = {
  created: () => "สร้างงานนี้",
  status: (d) => `เปลี่ยนสถานะ ${statusLabel(d.from)} → ${statusLabel(d.to)}`,
  assignee: () => "เปลี่ยนผู้รับผิดชอบ",
};

export function TaskDetailPanel({
  task, members, onClose, onUpdated, onDeleted,
}: {
  task: TaskRow;
  members: MemberRow[];
  onClose: () => void;
  onUpdated: (patch: Partial<TaskRow>) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [estimateHours, setEstimateHours] = useState(task.estimate_hours?.toString() ?? "");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingLog, setLoadingLog] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Controlled + reset here (not `defaultValue`) so switching tasks can never
    // leave a stale value from the PREVIOUS task sitting in one of these
    // inputs — defaultValue only applies once, at mount, and this panel isn't
    // guaranteed to remount between tasks (BoardShell renders it keyed only by
    // `selectedTask &&`, not by task id).
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStartDate(task.start_date ?? "");
    setDueDate(task.due_date ?? "");
    setEstimateHours(task.estimate_hours?.toString() ?? "");
    setErr(null);
    loadLog();
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLog() {
    setLoadingLog(true);
    const [cRes, aRes] = await Promise.all([
      fetch(`/api/tasks/${task.id}/comments`),
      fetch(`/api/tasks/${task.id}/activity`),
    ]);
    const cJson = await cRes.json();
    const aJson = await aRes.json();
    setComments(cJson.comments ?? []);
    setActivity(aJson.activity ?? []);
    setLoadingLog(false);
  }

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onUpdated(patch);
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: newComment.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setComments((c) => [...c, json.comment]);
        setNewComment("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("ลบงานนี้?")) return;
    setBusy(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", zIndex: 50 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "90vw",
        background: "var(--bg-raised)", borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-popover)", zIndex: 51, overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button className="btn sm" onClick={onClose}>ปิด ✕</button>
          <button className="btn sm danger" onClick={remove} disabled={busy}>ลบงาน</button>
        </div>

        {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

        <input className="input" style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}
          value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })} />

        <textarea className="input" placeholder="รายละเอียด…" rows={3} style={{ marginBottom: 14 }}
          value={description} onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (task.description ?? "") && save({ description: description || null })} />

        <div className="grid2" style={{ marginBottom: 14 }}>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ผู้รับผิดชอบ</div>
            <AssigneePicker members={members} value={task.assignee_id}
              onChange={(userId) => save({ assignee_id: userId })} disabled={busy} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ความสำคัญ</div>
            <select className="input" style={{ padding: "6px 10px", fontSize: 13 }} value={task.priority}
              onChange={(e) => save({ priority: e.target.value as TaskPriority })} disabled={busy}>
              {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>เริ่ม</div>
            <input type="date" className="input" style={{ padding: "6px 10px", fontSize: 13 }}
              value={startDate} onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => startDate !== (task.start_date ?? "") && save({ start_date: startDate || null })} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>กำหนดส่ง</div>
            <input type="date" className="input" style={{ padding: "6px 10px", fontSize: 13 }}
              value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => dueDate !== (task.due_date ?? "") && save({ due_date: dueDate || null })} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ประมาณ (ชม.)</div>
            <input type="number" min={0} step={0.5} className="input" style={{ padding: "6px 10px", fontSize: 13 }}
              value={estimateHours} onChange={(e) => setEstimateHours(e.target.value)}
              onBlur={() => {
                const current = task.estimate_hours?.toString() ?? "";
                if (estimateHours !== current) save({ estimate_hours: estimateHours ? Number(estimateHours) : null });
              }} />
          </div>
        </div>

        <div className="label">ความคิดเห็น</div>
        {loadingLog ? (
          <p className="dim">กำลังโหลด…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {comments.map((c) => (
              <div key={c.id} className="caption-box" style={{ padding: 10 }}>
                <div className="dim" style={{ fontSize: 11.5, marginBottom: 3 }}>
                  {c.author_name ?? c.author_id.slice(0, 8)} · {new Date(c.created_at).toLocaleString("th-TH")}
                </div>
                {c.body}
              </div>
            ))}
            {comments.length === 0 && <p className="dim">ยังไม่มีความคิดเห็น</p>}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input className="input" placeholder="เขียนความคิดเห็น…" value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendComment()} disabled={busy} />
          <button className="btn sm primary" onClick={sendComment} disabled={busy || !newComment.trim()}>ส่ง</button>
        </div>

        <div className="label">ประวัติ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {activity.map((a) => (
            <div key={a.id} className="dim" style={{ fontSize: 12 }}>
              {new Date(a.created_at).toLocaleString("th-TH")} · {a.actor_name ?? "ระบบ"} —{" "}
              {(ACTIVITY_LABEL[a.kind] ?? (() => a.kind))(a.detail)}
            </div>
          ))}
          {activity.length === 0 && !loadingLog && <p className="dim">ยังไม่มีประวัติ</p>}
        </div>
      </div>
    </>
  );
}
