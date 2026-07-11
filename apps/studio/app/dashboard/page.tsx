import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getMinutesUsedThisMonth, MINUTE_LIMITS, listProjects, listStyles } from "@cs/db";

interface Stats {
  email: string | null;
  plan: string;
  minutesUsed: number;
  minuteLimit: number;
  styles: number;
  videos: number;
  daysLeft: number;
}

async function getStats(): Promise<Stats | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = (profile?.plan as string) ?? "free";
  const [minutesUsed, projects, styles] = await Promise.all([
    getMinutesUsedThisMonth(db, user.id).catch(() => 0),
    listProjects(db).catch(() => []),
    listStyles(db).catch(() => []),
  ]);
  // Minutes reset at month boundary — show days until the quota resets.
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000));
  const videos = projects.filter((p) => p.status === "rendered" || p.status === "exported").length;
  return {
    email: user.email ?? null, plan, minutesUsed,
    minuteLimit: MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free,
    styles: styles.length, videos, daysLeft,
  };
}

const ACTIONS = [
  { href: "/video-editor", icon: "🎬", t: "Video Editor", s: "Timeline editor" },
  { href: "/gallery", icon: "▶", t: "Gallery", s: "ดู renders เก่า" },
  { href: "/guide", icon: "📖", t: "วิธีใช้งาน", s: "คู่มือ & สอนใช้ทีละขั้น" },
];

export default async function Dashboard() {
  const s = await getStats();
  const plan = s?.plan ?? "free";
  const used = s?.minutesUsed ?? 0;
  const limit = s?.minuteLimit ?? MINUTE_LIMITS.free;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const name = s?.email ? s.email.split("@")[0] : "ครีเอเตอร์";

  return (
    <div>
      <div className="dim" style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>
        แดชบอร์ด · {plan.toUpperCase()} PLAN
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px" }}>สวัสดีคุณ <span style={{ color: "var(--accent-2)" }}>{name}</span> 👋</h1>
          <p className="dim" style={{ margin: 0 }}>เริ่มสร้างเนื้อหาวิดีโอด้วย AI — เลือก action ด้านล่างเพื่อเริ่ม</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="pill" style={{ borderColor: "var(--accent)", color: "var(--accent-2)", textTransform: "uppercase" }}>
            🎬 {plan} plan
          </span>
          {s && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{s.daysLeft}d remaining</div>}
        </div>
      </div>

      {/* Minutes usage */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <b>โควตานาทีเดือนนี้</b>
          <span className="dim">{used}/{limit} นาที · เหลือ {Math.max(0, limit - used)} นาที</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-inset)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
        </div>
        <p className="dim" style={{ margin: "10px 0 0" }}>
          ระบบจัดการ AI (Gemini + MiniMax) ให้ — ไม่ต้องตั้งค่า key เอง · ใส่แค่ Pexels/Pixabay สำหรับ B-roll ·{" "}
          <Link href="/pricing" style={{ color: "var(--accent-2)" }}>ใช้เกินโควตา? อัปเกรดได้</Link>
        </p>
      </div>

      {/* Action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 4 }}>
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="card" style={{ display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{a.t} →</span>
              <span className="dim" style={{ fontSize: 12.5 }}>{a.s}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Stat counters */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="dim" style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Styles</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{s?.styles ?? 0}</div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="dim" style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Videos</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{s?.videos ?? 0}</div>
        </div>
      </div>

      {/* Upgrade banner */}
      {plan !== "business" && (
        <Link href="/pricing" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, borderColor: "var(--accent)" }}>
          <span>
            <b>อัปเกรดเป็น {plan === "free" ? "Pro" : "Business"}</b>
            <span className="dim" style={{ display: "block", fontSize: 13 }}>
              {plan === "free" ? "80 นาที/เดือน · คลิปยาว 6 นาที · ต่อ Agent/MCP" : "150 นาที/เดือน · คลิปยาว 10 นาที · Priority support"}
            </span>
          </span>
          <span className="btn primary">อัปเกรด →</span>
        </Link>
      )}
    </div>
  );
}
