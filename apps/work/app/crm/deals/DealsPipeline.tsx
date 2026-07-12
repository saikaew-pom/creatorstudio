"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanyRow, ContactRow, DealRow, MemberRow, StageRow } from "@cs/db";
import { computeFunnelTotals } from "@cs/db";
import { CompanyPicker } from "../CompanyPicker";
import { ContactPicker } from "../ContactPicker";
import { AssigneePicker } from "../../boards/AssigneePicker";

function thb(n: number): string {
  return n.toLocaleString("th-TH") + " ฿";
}

// Pipeline kanban — same plain HTML5 drag-and-drop technique as
// apps/work/app/boards/[boardId]/BoardView.tsx, with the fixes that review
// pass found baked in from the start here (draggable={!busy} + onDragEnd to
// close the drag-race window; an error banner + reload() resync on a failed
// move instead of silently leaving the card wherever the browser dropped it).
export function DealsPipeline({
  stages, initialDeals, companies, contacts, members,
}: { stages: StageRow[]; initialDeals: DealRow[]; companies: CompanyRow[]; contacts: ContactRow[]; members: MemberRow[] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/deals");
    const json = await res.json();
    setDeals(json.deals ?? []);
  }

  const byStage = new Map<string, DealRow[]>();
  for (const d of deals) {
    const list = byStage.get(d.stage_id) ?? [];
    list.push(d);
    byStage.set(d.stage_id, list);
  }
  for (const list of byStage.values()) list.sort((a, b) => a.position - b.position);

  const funnel = computeFunnelTotals(stages, deals);
  const openTotal = funnel.filter((f) => !f.is_won && !f.is_lost).reduce((s, f) => s + f.amount_thb, 0);
  const wonTotal = funnel.filter((f) => f.is_won).reduce((s, f) => s + f.amount_thb, 0);

  async function moveTo(stageId: string, prevId: string | null, nextId: string | null) {
    if (!dragId) return;
    setBusy(true);
    setErr(null);
    const movingId = dragId;
    try {
      const res = await fetch(`/api/deals/${movingId}/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, prevId, nextId }),
      });
      const json = await res.json();
      if (res.ok) {
        setDeals((prev) => prev.map((d) => (d.id === movingId ? { ...d, stage_id: stageId, position: json.position } : d)));
      } else {
        setErr(json.error ?? "ย้ายดีลไม่สำเร็จ");
        reload();
      }
    } finally {
      setBusy(false);
      setDragId(null);
    }
  }

  async function createDeal() {
    if (!title.trim() || stages.length === 0) return;
    setCreateBusy(true);
    setCreateErr(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), stageId: stages[0].id, companyId, primaryContactId: contactId,
          ownerId, amountThb: amount ? Number(amount) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างดีลไม่สำเร็จ");
      setDeals((prev) => [...prev, json.deal]);
      setTitle(""); setCompanyId(null); setContactId(null); setOwnerId(null); setAmount("");
      setCreating(false);
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div>
      <h1>ดีล/สปอนเซอร์</h1>
      <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
        <span className="dim">กำลังดำเนินการ: <b style={{ color: "var(--text)" }}>{thb(openTotal)}</b></span>
        <span className="dim">ปิดแล้ว: <b style={{ color: "var(--success)" }}>{thb(wonTotal)}</b></span>
      </div>

      {err && <p style={{ color: "var(--danger)", marginBottom: 8 }}>{err}</p>}

      {!creating ? (
        <button className="btn primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>+ สร้างดีลใหม่</button>
      ) : (
        <div className="card">
          <div className="grid2">
            <input className="input" placeholder="ชื่อดีล เช่น รีวิวครีมกันแดด x BrandX" value={title}
              onChange={(e) => setTitle(e.target.value)} disabled={createBusy} autoFocus />
            <input className="input" type="number" min={0} placeholder="มูลค่า (บาท)" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={createBusy} />
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} disabled={createBusy} />
            <ContactPicker contacts={contacts} companyId={companyId} value={contactId} onChange={setContactId} disabled={createBusy} />
            <AssigneePicker members={members} value={ownerId} onChange={setOwnerId} disabled={createBusy} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn primary" disabled={createBusy || !title.trim()} onClick={createDeal}>
              {createBusy ? <span className="spin" /> : "สร้าง"}
            </button>
            <button className="btn" disabled={createBusy} onClick={() => setCreating(false)}>ยกเลิก</button>
          </div>
          {createErr && <p style={{ color: "var(--danger)" }}>{createErr}</p>}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {stages.map((stage) => {
          const list = byStage.get(stage.id) ?? [];
          const stageTotal = funnel.find((f) => f.stage_id === stage.id)?.amount_thb ?? 0;
          return (
            <div key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); moveTo(stage.id, list.length ? list[list.length - 1].id : null, null); }}
              style={{
                background: "var(--bg-inset)", borderRadius: 10, padding: 10, minHeight: 240,
                width: 260, flexShrink: 0,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", justifyContent: "space-between" }}>
                  <span>{stage.name_th}</span>
                  <span className="dim">{list.length}</span>
                </div>
                <div className="dim" style={{ fontSize: 11 }}>{thb(stageTotal)}</div>
              </div>
              {list.map((d, i) => (
                <div key={d.id} draggable={!busy}
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveTo(stage.id, i > 0 ? list[i - 1].id : null, d.id);
                  }}
                  className="card"
                  style={{ margin: "0 0 8px", padding: 10, cursor: busy ? "wait" : "grab" }}
                >
                  <Link href={`/crm/deals/${d.id}`} style={{ display: "block" }}>
                    <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 13.5 }}>{d.title}</div>
                    {d.company_name && <div className="dim" style={{ fontSize: 11.5 }}>{d.company_name}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      {d.amount_thb != null && <span className="pill" style={{ fontSize: 11 }}>{thb(d.amount_thb)}</span>}
                      {d.owner_name && <span className="dim" style={{ fontSize: 11 }}>{d.owner_name}</span>}
                    </div>
                  </Link>
                </div>
              ))}
              {list.length === 0 && <p className="dim" style={{ fontSize: 12 }}>ลากดีลมาวางที่นี่</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
