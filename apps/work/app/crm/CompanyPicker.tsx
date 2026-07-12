"use client";
import type { CompanyRow } from "@cs/db";

export function CompanyPicker({
  companies, value, onChange, disabled,
}: { companies: CompanyRow[]; value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  return (
    <select className="input" style={{ padding: "6px 10px", fontSize: 13 }}
      value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">ไม่ระบุบริษัท</option>
      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
