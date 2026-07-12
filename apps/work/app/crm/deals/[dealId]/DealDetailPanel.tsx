"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CompanyRow, ContactRow, DealActivityRow, DealRow, DeliverableKind, DeliverableRow, DeliverableStatus,
  GenerationRow, MemberRow, ProjectRow, StageRow,
} from "@cs/db";
import { CompanyPicker } from "../../CompanyPicker";
import { ContactPicker } from "../../ContactPicker";
import { AssigneePicker } from "../../../boards/AssigneePicker";

type ManualActivityKind = "note" | "call" | "email" | "meeting";

// Mirrors the shape returned by app/api/deliverables/[id]/preview/route.ts —
// not imported from there since that file is a route module, not a shared
// package export.
type DeliverablePreview =
  | { kind: "none" }
  | { kind: "generation"; title: string | null; type: string; niche: string | null; status: string; imageUrl: string | null }
  | { kind: "project"; title: string; mode: string; status: string }
  | { kind: "missing" };

const ACTIVITY_KIND_LABEL: Record<string, string> = {
  note: "ความคิดเห็น", call: "โทรศัพท์", email: "อีเมล", meeting: "นัดประชุม",
  stage_change: "เปลี่ยนขั้นตอน", amount_change: "เปลี่ยนมูลค่า", ai_draft: "ร่างโดย AI",
};

const DELIVERABLE_KIND_LABEL: Record<DeliverableKind, string> = {
  content_kit: "ชุดคอนเทนต์", image: "รูปภาพ", video: "วิดีโอ", post: "โพสต์", other: "อื่นๆ",
};

const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  todo: "ยังไม่เริ่ม", in_production: "กำลังผลิต", in_review: "กำลังตรวจ", approved: "อนุมัติแล้ว", published: "เผยแพร่แล้ว",
};

function thb(n: number): string {
  return n.toLocaleString("th-TH") + " ฿";
}

export function DealDetailPanel({
  deal, stages, companies, contacts, members, initialDeliverables,
}: {
  deal: DealRow;
  stages: StageRow[];
  companies: CompanyRow[];
  contacts: ContactRow[];
  members: MemberRow[];
  initialDeliverables: DeliverableRow[];
}) {
  const router = useRouter();

  // ---------------------------------------------------------- header fields ---
  const [savedDeal, setSavedDeal] = useState(deal);
  const [title, setTitle] = useState(deal.title);
  const [companyId, setCompanyId] = useState(deal.company_id);
  const [contactId, setContactId] = useState(deal.primary_contact_id);
  const [ownerId, setOwnerId] = useState(deal.owner_id);
  const [amount, setAmount] = useState(deal.amount_thb?.toString() ?? "");
  const [probability, setProbability] = useState(deal.probability?.toString() ?? "");
  const [expectedClose, setExpectedClose] = useState(deal.expected_close ?? "");
  const [source, setSource] = useState(deal.source ?? "");
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Controlled + reset here (not `defaultValue`) — same TaskDetailPanel
    // discipline: don't let a stale value from a differently-navigated deal
    // linger in an input.
    setSavedDeal(deal);
    setTitle(deal.title);
    setCompanyId(deal.company_id);
    setContactId(deal.primary_contact_id);
    setOwnerId(deal.owner_id);
    setAmount(deal.amount_thb?.toString() ?? "");
    setProbability(deal.probability?.toString() ?? "");
    setExpectedClose(deal.expected_close ?? "");
    setSource(deal.source ?? "");
    setNotes(deal.notes ?? "");
    setErr(null);
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSavedDeal((d) => ({ ...d, ...patch }) as DealRow);
    } finally {
      setBusy(false);
    }
  }

  async function removeDeal() {
    if (!confirm("ลบดีลนี้? การลบไม่สามารถย้อนกลับได้")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? "ลบดีลไม่สำเร็จ");
        return;
      }
      router.push("/crm/deals");
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------- activity timeline ---
  const [activity, setActivity] = useState<DealActivityRow[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityKind, setActivityKind] = useState<ManualActivityKind>("note");
  const [activityBody, setActivityBody] = useState("");
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityErr, setActivityErr] = useState<string | null>(null);

  useEffect(() => { loadActivity(); }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadActivity() {
    setLoadingActivity(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/activity`);
      const json = await res.json();
      setActivity(json.activity ?? []);
    } finally {
      setLoadingActivity(false);
    }
  }

  async function submitActivity() {
    if (!activityBody.trim()) return;
    setActivityBusy(true);
    setActivityErr(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/activity`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: activityKind, body: activityBody.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActivityErr(json.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setActivity((prev) => [json.activity, ...prev]);
      setActivityBody("");
    } finally {
      setActivityBusy(false);
    }
  }

  const stageNameById = new Map(stages.map((s) => [s.id, s.name_th]));

  function detailLine(a: DealActivityRow): string | null {
    if (a.kind === "stage_change") {
      const from = typeof a.detail.from === "string" ? (stageNameById.get(a.detail.from) ?? "?") : "?";
      const to = typeof a.detail.to === "string" ? (stageNameById.get(a.detail.to) ?? "?") : "?";
      return `${from} → ${to}`;
    }
    if (a.kind === "amount_change") {
      const fmt = (v: unknown) => (typeof v === "number" ? thb(v) : "—");
      return `${fmt(a.detail.from)} → ${fmt(a.detail.to)}`;
    }
    return null;
  }

  // ------------------------------------------------------------- deliverables ---
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>(initialDeliverables);
  const [previews, setPreviews] = useState<Record<string, DeliverablePreview>>({});
  const [delivErr, setDelivErr] = useState<string | null>(null);

  const [creatingDeliverable, setCreatingDeliverable] = useState(false);
  const [newKind, setNewKind] = useState<DeliverableKind>("content_kit");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [assetOptions, setAssetOptions] = useState<{ id: string; label: string }[]>([]);
  const [assetId, setAssetId] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [delivBusy, setDelivBusy] = useState(false);
  const latestAssetKind = useRef<DeliverableKind | null>(null);

  useEffect(() => {
    loadPreviews(initialDeliverables);
    // Only ever needs to run once per deal — reload/delete flows call
    // loadPreviews directly instead of re-running this effect.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPreviews(list: DeliverableRow[]) {
    const entries = await Promise.all(
      list.map(async (d) => {
        const res = await fetch(`/api/deliverables/${d.id}/preview`);
        if (!res.ok) return [d.id, { kind: "none" } as DeliverablePreview] as const;
        const json = await res.json();
        return [d.id, (json.preview ?? { kind: "none" }) as DeliverablePreview] as const;
      })
    );
    setPreviews((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }

  async function reloadDeliverables() {
    const res = await fetch(`/api/deals/${deal.id}/deliverables`);
    const json = await res.json();
    const list: DeliverableRow[] = json.deliverables ?? [];
    setDeliverables(list);
    await loadPreviews(list);
  }

  useEffect(() => {
    if (!creatingDeliverable) return;
    latestAssetKind.current = newKind;
    loadAssetOptions(newKind);
  }, [creatingDeliverable, newKind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAssetOptions(kind: DeliverableKind) {
    setAssetId("");
    if (kind === "other") {
      setAssetOptions([]);
      return;
    }
    // Guards against an out-of-order response: if the user flips newKind again
    // before this fetch resolves, a stale response must not overwrite the
    // options for whatever kind is selected NOW.
    const requestKind = kind;
    setLoadingAssets(true);
    try {
      if (kind === "video") {
        const res = await fetch("/api/my-assets?kind=project");
        const json = await res.json();
        if (requestKind !== latestAssetKind.current) return;
        const projects: ProjectRow[] = json.projects ?? [];
        setAssetOptions(projects.map((p) => ({ id: p.id, label: p.name || "(ไม่มีชื่อ)" })));
      } else {
        const assetKind = kind === "image" ? "image" : "content_kit";
        const res = await fetch(`/api/my-assets?kind=${assetKind}`);
        const json = await res.json();
        if (requestKind !== latestAssetKind.current) return;
        const generations: GenerationRow[] = json.generations ?? [];
        setAssetOptions(generations.map((g) => ({ id: g.id, label: g.title || "(ไม่มีชื่อ)" })));
      }
    } finally {
      if (requestKind === latestAssetKind.current) setLoadingAssets(false);
    }
  }

  async function updateDeliverableStatus(id: string, status: DeliverableStatus) {
    setDelivErr(null);
    const res = await fetch(`/api/deliverables/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setDelivErr(json.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setDeliverables((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  async function removeDeliverable(id: string) {
    if (!confirm("ลบชิ้นงานนี้?")) return;
    setDelivErr(null);
    const res = await fetch(`/api/deliverables/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setDelivErr(json.error ?? "ลบชิ้นงานไม่สำเร็จ");
      return;
    }
    await reloadDeliverables();
  }

  async function createDeliverableSubmit() {
    if (!newTitle.trim()) return;
    setDelivBusy(true);
    setDelivErr(null);
    try {
      const body: Record<string, unknown> = { kind: newKind, title: newTitle.trim(), dueDate: newDue || null };
      if (newKind !== "other" && assetId) {
        if (newKind === "video") body.projectId = assetId;
        else body.generationId = assetId;
      }
      const res = await fetch(`/api/deals/${deal.id}/deliverables`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setDelivErr(json.error ?? "สร้างชิ้นงานไม่สำเร็จ");
        return;
      }
      setNewTitle(""); setNewDue(""); setAssetId(""); setCreatingDeliverable(false);
      await reloadDeliverables();
    } finally {
      setDelivBusy(false);
    }
  }

  function renderPreview(id: string) {
    const p = previews[id];
    if (!p) return <p className="dim" style={{ fontSize: 12 }}>กำลังโหลด…</p>;
    if (p.kind === "generation") {
      return (
        <div>
          {p.imageUrl && (
            <img src={p.imageUrl} alt={p.title ?? ""} style={{ width: "100%", borderRadius: 8, maxHeight: 120, objectFit: "cover" }} />
          )}
          <div className="dim" style={{ fontSize: 12, marginTop: p.imageUrl ? 6 : 0 }}>
            {p.title || "(ไม่มีชื่อ)"} · {p.niche ?? "-"} · {p.status}
          </div>
        </div>
      );
    }
    if (p.kind === "project") {
      return <div className="dim" style={{ fontSize: 12 }}>{p.title} · {p.mode} · {p.status}</div>;
    }
    if (p.kind === "missing") {
      return <p className="dim" style={{ fontSize: 12 }}>ผลงานที่เชื่อมโยงไว้ถูกลบไปแล้ว</p>;
    }
    return <p className="dim" style={{ fontSize: 12 }}>ยังไม่ได้เชื่อมโยงผลงาน</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Link href="/crm/deals" className="dim" style={{ fontSize: 13 }}>← กลับไปหน้าดีล</Link>
        <button className="btn sm danger" onClick={removeDeal} disabled={busy}>ลบดีล</button>
      </div>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <input className="input" style={{ fontSize: 20, fontWeight: 600 }} disabled={busy}
            value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const trimmed = title.trim();
              // Normalize local state to what actually gets persisted — otherwise
              // a title typed with surrounding whitespace never equals
              // savedDeal.title (which holds the trimmed value after save), and
              // every subsequent blur re-fires an identical, unnecessary save.
              if (trimmed) setTitle(trimmed);
              if (trimmed && trimmed !== savedDeal.title) save({ title: trimmed });
            }} />
          <span className="pill">{deal.stage_name ?? "—"}</span>
        </div>

        <div className="grid2">
          <div>
            <div className="label" style={{ marginTop: 0 }}>บริษัท</div>
            <CompanyPicker companies={companies} value={companyId} disabled={busy}
              onChange={(id) => { setCompanyId(id); save({ company_id: id }); }} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ผู้ติดต่อ</div>
            <ContactPicker contacts={contacts} companyId={companyId} value={contactId} disabled={busy}
              onChange={(id) => { setContactId(id); save({ primary_contact_id: id }); }} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ผู้รับผิดชอบ</div>
            <AssigneePicker members={members} value={ownerId} disabled={busy}
              onChange={(id) => { setOwnerId(id); save({ owner_id: id }); }} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>มูลค่า (บาท)</div>
            <input type="number" min={0} className="input" value={amount} disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const current = savedDeal.amount_thb?.toString() ?? "";
                if (amount !== current) save({ amount_thb: amount ? Number(amount) : null });
              }} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ความน่าจะเป็น (%)</div>
            <input type="number" min={0} max={100} className="input" value={probability} disabled={busy}
              onChange={(e) => setProbability(e.target.value)}
              onBlur={() => {
                const current = savedDeal.probability?.toString() ?? "";
                if (probability !== current) save({ probability: probability ? Number(probability) : null });
              }} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>คาดว่าจะปิด</div>
            <input type="date" className="input" value={expectedClose} disabled={busy}
              onChange={(e) => setExpectedClose(e.target.value)}
              onBlur={() => expectedClose !== (savedDeal.expected_close ?? "") && save({ expected_close: expectedClose || null })} />
          </div>
          <div>
            <div className="label" style={{ marginTop: 0 }}>ที่มา</div>
            <input className="input" value={source} disabled={busy}
              onChange={(e) => setSource(e.target.value)}
              onBlur={() => source !== (savedDeal.source ?? "") && save({ source: source || null })} />
          </div>
        </div>

        <div className="label">โน้ต</div>
        <textarea className="input" rows={4} value={notes} disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (savedDeal.notes ?? "") && save({ notes: notes || null })} />
      </div>

      <div className="card">
        <h3>ไทม์ไลน์กิจกรรม</h3>
        {activityErr && <p style={{ color: "var(--danger)" }}>{activityErr}</p>}
        {loadingActivity ? (
          <p className="dim">กำลังโหลด…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {activity.map((a) => (
              <div key={a.id} style={{ padding: 10, borderRadius: 8, background: "var(--bg-inset)" }}>
                <div className="dim" style={{ fontSize: 11.5, marginBottom: 3 }}>
                  {ACTIVITY_KIND_LABEL[a.kind] ?? a.kind} · {a.actor_name ?? "ระบบ"} · {new Date(a.occurred_at).toLocaleString("th-TH")}
                </div>
                {detailLine(a) ?? a.body}
              </div>
            ))}
            {activity.length === 0 && <p className="dim">ยังไม่มีกิจกรรม</p>}
          </div>
        )}

        <div className="grid2" style={{ marginBottom: 8 }}>
          <select className="input" value={activityKind} disabled={activityBusy}
            onChange={(e) => setActivityKind(e.target.value as ManualActivityKind)}>
            <option value="note">ความคิดเห็น</option>
            <option value="call">โทรศัพท์</option>
            <option value="email">อีเมล</option>
            <option value="meeting">นัดประชุม</option>
          </select>
        </div>
        <textarea className="input" rows={2} placeholder="เขียนบันทึกกิจกรรม…" value={activityBody} disabled={activityBusy}
          onChange={(e) => setActivityBody(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="btn primary sm" disabled={activityBusy || !activityBody.trim()} onClick={submitActivity}>
          {activityBusy ? <span className="spin" /> : "บันทึก"}
        </button>
      </div>

      <div className="card">
        <div className="section-head">
          <h3>ชิ้นงานที่ต้องส่งมอบ</h3>
          <div className="section-actions">
            {!creatingDeliverable && (
              <button className="btn sm primary" onClick={() => setCreatingDeliverable(true)}>+ เพิ่มชิ้นงาน</button>
            )}
          </div>
        </div>
        {delivErr && <p style={{ color: "var(--danger)" }}>{delivErr}</p>}

        {creatingDeliverable && (
          <div style={{ background: "var(--bg-inset)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div className="grid2">
              <select className="input" value={newKind} disabled={delivBusy}
                onChange={(e) => setNewKind(e.target.value as DeliverableKind)}>
                <option value="content_kit">ชุดคอนเทนต์</option>
                <option value="image">รูปภาพ</option>
                <option value="video">วิดีโอ</option>
                <option value="post">โพสต์</option>
                <option value="other">อื่นๆ</option>
              </select>
              <input className="input" placeholder="ชื่อชิ้นงาน" value={newTitle} disabled={delivBusy}
                onChange={(e) => setNewTitle(e.target.value)} />
              <input type="date" className="input" value={newDue} disabled={delivBusy}
                onChange={(e) => setNewDue(e.target.value)} />
              {newKind !== "other" && (
                <select className="input" value={assetId} disabled={delivBusy || loadingAssets}
                  onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">{loadingAssets ? "กำลังโหลด…" : "ไม่เชื่อมโยงผลงาน"}</option>
                  {assetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="btn primary sm" disabled={delivBusy || !newTitle.trim()} onClick={createDeliverableSubmit}>
                {delivBusy ? <span className="spin" /> : "สร้าง"}
              </button>
              <button className="btn sm" disabled={delivBusy} onClick={() => setCreatingDeliverable(false)}>ยกเลิก</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deliverables.map((d) => (
            <div key={d.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <span className="pill" style={{ marginRight: 8 }}>{DELIVERABLE_KIND_LABEL[d.kind]}</span>
                  <b>{d.title}</b>
                </div>
                <button className="btn sm danger" onClick={() => removeDeliverable(d.id)}>ลบ</button>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <select className="input" style={{ width: "auto", padding: "4px 8px", fontSize: 12.5 }} value={d.status}
                  onChange={(e) => updateDeliverableStatus(d.id, e.target.value as DeliverableStatus)}>
                  {Object.entries(DELIVERABLE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {d.due_date && <span className="dim" style={{ fontSize: 12 }}>กำหนดส่ง {new Date(d.due_date).toLocaleDateString("th-TH")}</span>}
              </div>
              {renderPreview(d.id)}
            </div>
          ))}
          {deliverables.length === 0 && !creatingDeliverable && <p className="dim">ยังไม่มีชิ้นงาน</p>}
        </div>
      </div>
    </div>
  );
}
