"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@cs/db";

function InviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    browserClient().auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "รับคำเชิญไม่สำเร็จ");
      router.push("/dashboard");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <div className="empty-state"><div className="icon">✉️</div><p>ลิงก์คำเชิญไม่ถูกต้อง</p></div>;
  }

  return (
    <div style={{ maxWidth: 420, margin: "10vh auto" }}>
      <h1 style={{ marginBottom: 4 }}>🗂️ คำเชิญเข้า Workspace</h1>
      <div className="card">
        {signedIn === null && <p className="dim">กำลังตรวจสอบสถานะเข้าสู่ระบบ…</p>}
        {signedIn === false && (
          <>
            <p className="dim">เข้าสู่ระบบด้วยอีเมลที่ได้รับคำเชิญก่อน แล้วกลับมาที่หน้านี้เพื่อยืนยัน</p>
            <a className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
              href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>
              เข้าสู่ระบบ
            </a>
          </>
        )}
        {signedIn === true && (
          <>
            <p className="dim">กดยืนยันเพื่อเข้าร่วม workspace ที่ได้รับเชิญ</p>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
              disabled={busy} onClick={accept}>
              {busy ? <span className="spin" /> : "ยืนยันเข้าร่วม"}
            </button>
          </>
        )}
        {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteInner />
    </Suspense>
  );
}
