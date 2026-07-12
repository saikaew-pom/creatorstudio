import type { TaskPriority, TaskStatus } from "@cs/db";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "ยังไม่เริ่ม", in_progress: "กำลังทำ", blocked: "ติดขัด", done: "เสร็จแล้ว",
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "var(--text-dim)", normal: "var(--accent-2)", high: "var(--warn)", urgent: "var(--danger)",
};

export function StatusChip({ status }: { status: TaskStatus }) {
  return <span className="pill">{STATUS_LABEL[status]}</span>;
}

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  return (
    <span className="pill" style={{ color: PRIORITY_COLOR[priority], borderColor: PRIORITY_COLOR[priority] }}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
