"use client";
import type { ContactRow } from "@cs/db";

export function ContactPicker({
  contacts, companyId, value, onChange, disabled,
}: { contacts: ContactRow[]; companyId?: string | null; value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const filtered = companyId ? contacts.filter((c) => c.company_id === companyId) : contacts;
  return (
    <select className="input" style={{ padding: "6px 10px", fontSize: 13 }}
      value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">ไม่ระบุผู้ติดต่อ</option>
      {filtered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
