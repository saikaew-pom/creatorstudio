"use client";
import type { MemberRow } from "@cs/db";

export function AssigneePicker({
  members, value, onChange, disabled,
}: { members: MemberRow[]; value: string | null; onChange: (userId: string | null) => void; disabled?: boolean }) {
  return (
    <select
      className="input"
      style={{ padding: "6px 10px", fontSize: 13 }}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">ไม่มีผู้รับผิดชอบ</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>{m.display_name ?? m.user_id.slice(0, 8)}</option>
      ))}
    </select>
  );
}
