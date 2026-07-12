"use client";
import { useEffect, useState } from "react";
import type { CompanyRow, ContactRow } from "@cs/db";
import { CompanyPicker } from "../CompanyPicker";

export function ContactsPanel({
  initialContacts, companies,
}: { initialContacts: ContactRow[]; companies: CompanyRow[]; wsId: string }) {
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [busy, setBusy] = useState(false);

  async function createContact() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), company_id: companyId,
          role_title: roleTitle.trim() || null, email: email.trim() || null,
          phone: phone.trim() || null, line_id: lineId.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างผู้ติดต่อไม่สำเร็จ");
      setContacts((cs) => [...cs, json.contact].sort((a, b) => a.name.localeCompare(b.name)));
      setName(""); setCompanyId(null); setRoleTitle(""); setEmail(""); setPhone(""); setLineId("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patchContact(id: string, patch: Record<string, unknown>) {
    setErr(null);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    } catch {
      setErr("บันทึกไม่สำเร็จ");
    }
  }

  async function removeContact(id: string) {
    if (!confirm("ลบผู้ติดต่อนี้?")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "ลบผู้ติดต่อไม่สำเร็จ");
        return;
      }
      setContacts((cs) => cs.filter((c) => c.id !== id));
    } catch {
      setErr("ลบผู้ติดต่อไม่สำเร็จ");
    }
  }

  return (
    <div>
      <h1>ผู้ติดต่อ</h1>
      <p className="dim" style={{ marginBottom: 20 }}>รายชื่อผู้ติดต่อของแบรนด์/สปอนเซอร์ทั้งหมด</p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="card">
        <h3>+ เพิ่มผู้ติดต่อใหม่</h3>
        <div className="grid2">
          <input className="input" placeholder="ชื่อ *" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} disabled={busy} />
          <input className="input" placeholder="ตำแหน่ง" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} disabled={busy} />
          <input className="input" type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="input" placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
          <input className="input" placeholder="LINE ID" value={lineId} onChange={(e) => setLineId(e.target.value)} disabled={busy} />
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} disabled={busy || !name.trim()} onClick={createContact}>
          {busy ? <span className="spin" /> : "+ เพิ่มผู้ติดต่อ"}
        </button>
      </div>

      <div className="card">
        <h3>รายชื่อผู้ติดต่อ ({contacts.length})</h3>
        {contacts.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👤</div>
            <p>ยังไม่มีผู้ติดต่อ — เพิ่มรายชื่อแรกด้านบน</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="row-table">
              <thead>
                <tr>
                  <th>ชื่อ</th><th>บริษัท</th><th>ตำแหน่ง</th><th>อีเมล</th><th>เบอร์โทร</th><th>LINE ID</th><th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <ContactRowItem
                    key={c.id}
                    contact={c}
                    companies={companies}
                    onSave={(patch) => patchContact(c.id, patch)}
                    onDelete={() => removeContact(c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRowItem({
  contact, companies, onSave, onDelete,
}: {
  contact: ContactRow;
  companies: CompanyRow[];
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [roleTitle, setRoleTitle] = useState(contact.role_title ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [lineId, setLineId] = useState(contact.line_id ?? "");

  useEffect(() => {
    // Controlled + reset here (not `defaultValue`) — same discipline as
    // CompanyRowItem: this row stays mounted (keyed by contact.id) across
    // patchContact updates, so re-sync fields from props whenever the
    // underlying contact changes instead of trusting a mount-time-only
    // default. Without this, a successful save that trims whitespace
    // server-side (e.g. `email.trim() || null`) leaves the input showing
    // the untrimmed value forever, since the local state was never reset
    // to match what the server (and the optimistically-updated parent
    // list) actually persisted.
    setName(contact.name);
    setRoleTitle(contact.role_title ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setLineId(contact.line_id ?? "");
  }, [contact.id, contact.name, contact.role_title, contact.email, contact.phone, contact.line_id]);

  return (
    <tr>
      <td>
        <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (!v) { setName(contact.name); return; }
            if (v !== contact.name) onSave({ name: v });
          }} />
      </td>
      <td>
        <CompanyPicker companies={companies} value={contact.company_id}
          onChange={(id) => onSave({ company_id: id })} />
      </td>
      <td>
        <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          onBlur={() => roleTitle !== (contact.role_title ?? "") && onSave({ role_title: roleTitle.trim() || null })} />
      </td>
      <td>
        <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email !== (contact.email ?? "") && onSave({ email: email.trim() || null })} />
      </td>
      <td>
        <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== (contact.phone ?? "") && onSave({ phone: phone.trim() || null })} />
      </td>
      <td>
        <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          onBlur={() => lineId !== (contact.line_id ?? "") && onSave({ line_id: lineId.trim() || null })} />
      </td>
      <td>
        <button className="btn sm danger" onClick={onDelete}>ลบ</button>
      </td>
    </tr>
  );
}
