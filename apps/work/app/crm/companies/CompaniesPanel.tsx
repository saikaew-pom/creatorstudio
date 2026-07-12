"use client";
import { useEffect, useState } from "react";
import type { CompanyRow } from "@cs/db";

export function CompaniesPanel({
  initialCompanies, wsId,
}: { initialCompanies: CompanyRow[]; wsId: string }) {
  void wsId; // API routes derive the active workspace from the session cookie, not this prop

  const [companies, setCompanies] = useState(initialCompanies);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function createCompany() {
    const name = newName.trim();
    if (!name) return;
    setCreateBusy(true);
    setCreateErr(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website: newWebsite.trim() || null, industry: newIndustry.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างบริษัทไม่สำเร็จ");
      setCompanies((prev) => [...prev, json.company as CompanyRow].sort((a, b) => a.name.localeCompare(b.name, "th")));
      setNewName(""); setNewWebsite(""); setNewIndustry("");
      setCreating(false);
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreateBusy(false);
    }
  }

  function applyPatch(id: string, patch: Partial<CompanyRow>) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function remove(id: string) {
    if (!confirm("ลบบริษัทนี้?")) return;
    setErr(null);
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErr(json.error ?? "ลบบริษัทไม่สำเร็จ");
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }

  return (
    <div>
      <h1>บริษัท/สปอนเซอร์</h1>
      <p className="dim" style={{ marginBottom: 20 }}>รายชื่อบริษัทที่ติดต่อทำดีลด้วย</p>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      {!creating ? (
        <button className="btn primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>+ เพิ่มบริษัทใหม่</button>
      ) : (
        <div className="card">
          <h3>บริษัทใหม่</h3>
          <div className="grid2">
            <input className="input" placeholder="ชื่อบริษัท *" value={newName}
              onChange={(e) => setNewName(e.target.value)} disabled={createBusy} autoFocus />
            <input className="input" placeholder="เว็บไซต์" value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)} disabled={createBusy} />
            <input className="input" placeholder="อุตสาหกรรม" value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)} disabled={createBusy} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn primary" disabled={createBusy || !newName.trim()} onClick={createCompany}>
              {createBusy ? <span className="spin" /> : "สร้าง"}
            </button>
            <button className="btn" disabled={createBusy} onClick={() => { setCreating(false); setCreateErr(null); }}>ยกเลิก</button>
          </div>
          {createErr && <p style={{ color: "var(--danger)" }}>{createErr}</p>}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏢</div>
          <p>ยังไม่มีบริษัท — เพิ่มบริษัทแรกด้านบน</p>
        </div>
      ) : (
        <div className="card">
          <table className="row-table">
            <thead><tr><th>ชื่อ</th><th>เว็บไซต์</th><th>อุตสาหกรรม</th><th></th></tr></thead>
            <tbody>
              {companies.map((c) => (
                <CompanyRowItem key={c.id} company={c} expanded={expandedId === c.id}
                  onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                  onUpdated={(patch) => applyPatch(c.id, patch)}
                  onDeleted={() => remove(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyRowItem({
  company, expanded, onToggle, onUpdated, onDeleted,
}: {
  company: CompanyRow; expanded: boolean; onToggle: () => void;
  onUpdated: (patch: Partial<CompanyRow>) => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [notes, setNotes] = useState(company.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Controlled + reset here (not `defaultValue`) — same discipline as
    // TaskDetailPanel (M10 fix): this row stays mounted across expand/collapse,
    // so re-sync fields from props whenever the underlying company changes
    // instead of trusting a mount-time-only default.
    setName(company.name);
    setWebsite(company.website ?? "");
    setIndustry(company.industry ?? "");
    setNotes(company.notes ?? "");
    setErr(null);
  }, [company.id, company.name, company.website, company.industry, company.notes]);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
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

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>{company.name}</td>
        <td className="dim">{company.website ?? "—"}</td>
        <td className="dim">{company.industry ?? "—"}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <button className="btn sm danger" onClick={onDeleted}>ลบ</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ background: "var(--bg-inset)" }}>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            <div className="grid2">
              <div>
                <div className="label" style={{ marginTop: 0 }}>ชื่อบริษัท</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() && name !== company.name && save({ name: name.trim() })} disabled={busy} />
              </div>
              <div>
                <div className="label" style={{ marginTop: 0 }}>เว็บไซต์</div>
                <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)}
                  onBlur={() => website !== (company.website ?? "") && save({ website: website.trim() || null })} disabled={busy} />
              </div>
              <div>
                <div className="label" style={{ marginTop: 0 }}>อุตสาหกรรม</div>
                <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}
                  onBlur={() => industry !== (company.industry ?? "") && save({ industry: industry.trim() || null })} disabled={busy} />
              </div>
            </div>
            <div className="label">โน้ต</div>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (company.notes ?? "") && save({ notes: notes.trim() || null })} disabled={busy} />
          </td>
        </tr>
      )}
    </>
  );
}
