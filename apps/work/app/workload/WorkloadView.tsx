"use client";
import { useEffect, useState } from "react";
import type { WorkloadRow } from "@cs/db";

export function WorkloadView() {
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/workload");
      const json = await res.json();
      setWorkload(json.workload ?? []);
      setSince(json.since ?? null);
      setUntil(json.until ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>ภาระงาน</h1>
      <p className="dim" style={{ marginBottom: 20 }}>
        {since && until
          ? `${new Date(since).toLocaleDateString("th-TH")} – ${new Date(until).toLocaleDateString("th-TH")}`
          : "สัปดาห์นี้"}
      </p>

      {loading ? (
        <p className="dim">กำลังโหลด…</p>
      ) : workload.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <p>ยังไม่มีสมาชิกใน workspace นี้</p>
        </div>
      ) : (
        workload.map((w) => {
          const pct = w.capacity_hours > 0 ? Math.min(w.allocated_hours / w.capacity_hours, 1) * 100 : 0;
          return (
            <div key={w.user_id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <b>{w.display_name ?? w.user_id.slice(0, 8)}</b>
                {w.over_allocated && (
                  <span className="pill" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                    เกินกำลัง
                  </span>
                )}
              </div>
              <div style={{ background: "var(--bg-inset)", borderRadius: 999, height: 10, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`, height: "100%",
                    background: w.over_allocated ? "var(--danger)" : "var(--accent)",
                  }}
                />
              </div>
              <p className="dim" style={{ marginTop: 8, fontSize: 12.5 }}>
                {w.allocated_hours}h / {w.capacity_hours}h ต่อสัปดาห์
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}
