"use client";
import Link from "next/link";
import { browserClient } from "@cs/db";

export function AccountFooter({ configured, email }: { configured: boolean; email: string | null }) {
  if (!configured) {
    return (
      <div className="nav-item" style={{ opacity: 0.7 }}>
        <span className="t">โหมดทดลอง</span>
        <span className="s">ยังไม่ได้ต่อ Supabase</span>
      </div>
    );
  }
  if (!email) {
    return (
      <Link href="/login" className="nav-item">
        <span className="t">เข้าสู่ระบบ</span>
        <span className="s">เพื่อดู workspace ของคุณ</span>
      </Link>
    );
  }
  async function logout() {
    await browserClient().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <div className="nav-item" style={{ cursor: "default" }}>
      <span className="t" style={{ fontSize: 13, wordBreak: "break-all" }}>{email}</span>
      <span className="s" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={logout}>
        ออกจากระบบ
      </span>
    </div>
  );
}
