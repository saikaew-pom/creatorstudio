"use client";
// Campaign Mode (M15b) — the signature differentiator: one topic → a 7-day content
// calendar with a deliberate story arc, each day deep-linking into the normal
// Content Studio flow via ?topic=&template= (already read by StudioInner on mount).
import { useState } from "react";
import { TEMPLATE_CHIPS, type DayPlan } from "@cs/prompts";

const GOAL_ICON = ["🎬", "📚", "📚", "🤝", "🤝", "💬", "🔥"]; // day 1..7 visual rhythm

export function CampaignPanel({ topic, niche }: { topic: string; niche: string }) {
  const [days, setDays] = useState<DayPlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsSpent, setCreditsSpent] = useState<number | null>(null);

  async function generateCampaign() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, niche: niche || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDays(data.days);
      setCreditsSpent(data.creditsSpent ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ borderColor: "var(--gold)" }}>
      <div className="section-head">
        <h3>🗓️ แคมเปญ 7 วัน <span className="pill" style={{ fontSize: 11, color: "var(--gold)", borderColor: "var(--gold)" }}>ใหม่</span></h3>
      </div>
      <p className="dim" style={{ marginTop: -4 }}>
        แทนที่จะสร้างทีละโพสต์ — ให้ AI วางแผนคอนเทนต์ 7 วันรวดที่มีสตอรี่อาร์คต่อเนื่อง (รับรู้ → ให้ความรู้ → เชื่อใจ → ปิดการขาย) จากหัวข้อเดียวกันด้านบน
      </p>
      {!days && (
        <button className="btn primary" disabled={!topic.trim() || loading} onClick={generateCampaign}>
          {loading ? <><span className="spin" /> กำลังวางแผนแคมเปญ 7 วัน…</> : "🗓️ สร้างแคมเปญ 7 วัน (5 เครดิต)"}
        </button>
      )}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {days && (
        <>
          {creditsSpent ? <p className="dim" style={{ fontSize: 12 }}>ใช้ไป {creditsSpent} เครดิต</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 8 }}>
            {days.map((d) => (
              <div key={d.day} className="card" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>Day {d.day} {GOAL_ICON[d.day - 1] ?? ""}</b>
                  <span className="pill" style={{ fontSize: 11 }}>{TEMPLATE_CHIPS[d.template]?.name_th ?? d.template}</span>
                </div>
                <p className="dim" style={{ fontSize: 12, margin: "6px 0" }}>{d.goal_th}</p>
                <div className="caption-box" style={{ fontSize: 13 }}>{d.hook}</div>
                <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>{d.topic_line}</p>
                {/* Plain <a> (not next/link): the target is the SAME route with new
                    query params, so a client-side nav would re-render StudioInner
                    without re-running its useState initializers — topic/template
                    would silently stay stale. A full navigation guarantees fresh state. */}
                <a
                  href={`/studio?topic=${encodeURIComponent(d.topic_line)}&template=${d.template}`}
                  className="btn sm" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                >
                  สร้างโพสต์เต็ม →
                </a>
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setDays(null)}>← สร้างแคมเปญใหม่</button>
        </>
      )}
    </div>
  );
}
