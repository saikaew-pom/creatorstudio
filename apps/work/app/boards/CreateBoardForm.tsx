"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateBoardForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างบอร์ดไม่สำเร็จ");
      router.push(`/boards/${json.board.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn primary" style={{ marginBottom: 16 }} onClick={() => setOpen(true)}>
        + สร้างบอร์ดใหม่
      </button>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 6 }}>
        <input className="input" placeholder="ชื่อบอร์ด" value={name} disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()} autoFocus />
        <button className="btn primary" disabled={busy || !name.trim()} onClick={create}>
          {busy ? <span className="spin" /> : "สร้าง"}
        </button>
        <button className="btn" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button>
      </div>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
