"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserClient, isSupabaseConfigured } from "@cs/db";

// Only ever redirect same-origin: reject protocol-relative ("//host"),
// absolute ("https://host"), and backslash forms (some browsers treat "\" as
// "/", so "/\evil.com" can resolve as "//evil.com") — anything else falls
// back to the dashboard rather than letting `next` send the user off-site.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return "/dashboard";
  }
  return raw;
}

function LoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const next = safeNext(params.get("next"));

  const configured = isSupabaseConfigured();

  async function submit() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const supabase = browserClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("สมัครแล้ว — เช็กอีเมลเพื่อยืนยัน (ถ้าเปิด email confirmation ไว้) แล้วเข้าสู่ระบบได้เลย");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    try {
      const supabase = browserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "8vh auto" }}>
      <h1 style={{ marginBottom: 4 }}>🗂️ Creator Studio — Work</h1>
      <p className="dim">{mode === "signin" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}</p>

      {!configured && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>⚠ ยังไม่ได้ตั้งค่า Supabase</b>
          <p className="dim">ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env ก่อน แล้วรีสตาร์ท dev server</p>
        </div>
      )}

      <div className="card">
        <div className="label">อีเมล</div>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" disabled={!configured} />
        <div className="label">รหัสผ่าน</div>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••" disabled={!configured}
          onKeyDown={(e) => e.key === "Enter" && configured && !busy && submit()} />
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
          disabled={!configured || busy || !email || !password} onClick={submit}>
          {busy ? <span className="spin" /> : mode === "signin" ? "เข้าสู่ระบบ" : "สมัคร"}
        </button>
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          disabled={!configured} onClick={google}>
          เข้าสู่ระบบด้วย Google
        </button>
        {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
        {msg && <p style={{ color: "var(--success)" }}>{msg}</p>}
        <p className="dim" style={{ marginTop: 12 }}>
          {mode === "signin" ? "ยังไม่มีบัญชี? " : "มีบัญชีแล้ว? "}
          <a style={{ color: "var(--accent)", cursor: "pointer" }}
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "สมัครใช้งาน" : "เข้าสู่ระบบ"}
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
