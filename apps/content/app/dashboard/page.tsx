"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "../LangProvider";

export default function Dashboard() {
  const [topic, setTopic] = useState("");
  const router = useRouter();
  const t = useT();
  return (
    <div>
      <div className="topbar">
        <span className="pill">{t("dashboard.pill_no_brand")}</span>
        <span className="pill">{t("dashboard.pill_model")}</span>
        <span className="pill">{t("dashboard.pill_streak")}</span>
      </div>
      <h1 style={{ marginBottom: 4 }}>{t("dashboard.greeting")} 👋</h1>
      <p className="dim">{t("dashboard.subtitle")}</p>

      <div className="card">
        <h3>{t("dashboard.start_title")}</h3>
        <p className="dim" style={{ marginTop: 0 }}>{t("dashboard.start_desc")}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            placeholder={t("dashboard.placeholder")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && topic.trim())
                router.push(`/studio?topic=${encodeURIComponent(topic)}`);
            }}
          />
          <button
            className="btn primary"
            disabled={!topic.trim()}
            onClick={() => router.push(`/studio?topic=${encodeURIComponent(topic)}`)}
          >
            {topic.trim() ? t("dashboard.cta_ready") : t("dashboard.cta_empty")}
          </button>
        </div>
        <div className="chip-row" style={{ marginTop: 12 }}>
          <span className="dim">{t("dashboard.or")}</span>
          <Link href="/viral-studio" className="chip">{t("dashboard.trend")}</Link>
          <Link href="/studio" className="chip">{t("dashboard.find_idea")}</Link>
          <Link href="/brands" className="chip">{t("dashboard.set_brand")}</Link>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>{t("dashboard.getting_started")}</h3>
          <div className="dim">
            <div>◻ {t("dashboard.step1")}</div>
            <div>◻ {t("dashboard.step2")}</div>
            <div>◻ {t("dashboard.step3")}</div>
            <div>◻ {t("dashboard.step4")}</div>
          </div>
        </div>
        <div className="card">
          <h3>{t("dashboard.lock_title")}</h3>
          <p className="dim">{t("dashboard.lock_desc")}</p>
          <Link href="/brands" className="btn sm">{t("dashboard.lock_cta")}</Link>
        </div>
      </div>
    </div>
  );
}
