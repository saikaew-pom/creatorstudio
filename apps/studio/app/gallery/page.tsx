import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { publicRenderUrl } from "@cs/db";

interface DoneRender {
  project_id: string;
  kind: string;
  result_path: string;
  created_at: string;
}

async function getRenders(): Promise<DoneRender[] | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getServerSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const { data: jobs } = await db
    .from("render_jobs")
    .select("project_id, kind, result_path, created_at")
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("created_at", { ascending: false });
  return (jobs ?? []) as DoneRender[];
}

export default async function GalleryPage() {
  const renders = await getRenders();
  const db = isSupabaseConfigured() ? getServerSupabase() : null;

  return (
    <div>
      <h1>Gallery</h1>
      <p className="dim">วิดีโอที่เรนเดอร์แล้วทั้งหมด — เปิดใน Video Editor เพื่อแต่งซับหรือส่งออกใหม่</p>

      {!renders || renders.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40 }}>🎬</div>
          <p className="dim">ยังไม่มีวิดีโอที่เรนเดอร์ · <Link href="/video-editor" style={{ color: "var(--accent-2)" }}>สร้างวิดีโอแรก →</Link></p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
          {renders.map((r, i) => {
            const url = db ? publicRenderUrl(db, r.result_path) : "";
            return (
              <div key={`${r.project_id}-${i}`} className="card" style={{ margin: 0, padding: 10 }}>
                <video src={url} controls preload="metadata" style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "9/16", objectFit: "cover" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span className="pill" style={{ fontSize: 11 }}>{r.kind === "export" ? "ส่งออก (มีซับ)" : "เรนเดอร์"}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString("th-TH")}</span>
                </div>
                <Link href={`/video-editor?project=${r.project_id}`} className="btn sm" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
                  เปิดใน Editor →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
