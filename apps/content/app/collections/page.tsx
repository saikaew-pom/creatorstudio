"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient, isSupabaseConfigured } from "@cs/db";

interface CollectionRow {
  id: string;
  name: string;
  kind: string;
}

export default function CollectionsPage() {
  const [folders, setFolders] = useState<CollectionRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const db = browserClient();
    const { data } = await db.auth.getUser();
    if (!data.user) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const { data: rows } = await db.from("collections").select("*").order("created_at", { ascending: false });
    setFolders((rows ?? []) as CollectionRow[]);
    const { data: gens } = await db.from("generations").select("folder_id").not("folder_id", "is", null);
    const c: Record<string, number> = {};
    for (const g of (gens ?? []) as { folder_id: string }[]) c[g.folder_id] = (c[g.folder_id] ?? 0) + 1;
    setCounts(c);
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignedIn(false);
      return;
    }
    load();
  }, []);

  async function createFolder() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const db = browserClient();
      const { data } = await db.auth.getUser();
      if (!data.user) return;
      await db.from("collections").insert({ user_id: data.user.id, name: name.trim(), kind: "folder" });
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function removeFolder(id: string) {
    const db = browserClient();
    await db.from("collections").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      <h1>📁 โฟลเดอร์ของฉัน</h1>
      <p className="dim">จัดกลุ่มผลงานเป็นโฟลเดอร์ · ตามแคมเปญ · ลูกค้า · หรือธีมที่ชอบ</p>

      {signedIn === false && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>{isSupabaseConfigured() ? "ยังไม่ได้เข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</b>
          {isSupabaseConfigured() && <div><Link href="/login?next=/collections" className="btn primary" style={{ marginTop: 8 }}>เข้าสู่ระบบ</Link></div>}
        </div>
      )}

      {signedIn && (
        <>
          <div className="card">
            <div style={{ display: "flex", gap: 10 }}>
              <input className="input" placeholder="ชื่อโฟลเดอร์ เช่น แคมเปญมกราคม, ลูกค้า A"
                value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()} />
              <button className="btn primary" disabled={!name.trim() || creating} onClick={createFolder}>
                + สร้างโฟลเดอร์ใหม่
              </button>
            </div>
          </div>

          {folders.length === 0 ? (
            <div className="card">
              <p className="dim">ยังไม่มีโฟลเดอร์ — สร้างโฟลเดอร์แรกเพื่อจัดกลุ่มผลงาน</p>
              <p className="dim">💡 ทิป: จัดตามแคมเปญ ลูกค้า หรือเดือน · ค้นย้อนหลังง่ายกว่าเรียงแบบเดิม</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {folders.map((f) => (
                <div key={f.id} className="card" style={{ margin: 0 }}>
                  <div style={{ fontWeight: 600 }}>{f.name}</div>
                  <div className="dim">{counts[f.id] ?? 0} ผลงาน</div>
                  <button className="btn sm" style={{ marginTop: 8 }} onClick={() => removeFolder(f.id)}>ลบ</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
