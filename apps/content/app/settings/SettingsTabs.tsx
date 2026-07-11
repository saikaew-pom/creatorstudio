"use client";
// M17 — Settings page (Profile / API Keys / Agent-MCP). No Billing tab here, unlike
// studio's: the content app already has dedicated /credits and /pricing pages in the
// main nav, so a third copy of the same numbers would just be a duplicate to keep in
// sync — the Profile tab links out to both instead.
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  browserClient, isSupabaseConfigured, getApiKeyStatus, saveApiKey, deleteApiKey,
  type ApiKeyProvider, type ApiKeyStatus,
} from "@cs/db";
import { useT } from "../LangProvider";

export interface SettingsInitial {
  email: string | null;
  displayName: string;
}

interface TokenRow { id: string; name: string; last_used_at: string | null; revoked: boolean; created_at: string; }

type Tab = "profile" | "keys" | "mcp";

export function SettingsTabs({ initial }: { initial: SettingsInitial }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("profile");
  const TABS: { key: Tab; labelKey: "settings.tab.profile" | "settings.tab.keys" | "settings.tab.mcp"; icon: string }[] = [
    { key: "profile", labelKey: "settings.tab.profile", icon: "👤" },
    { key: "keys", labelKey: "settings.tab.keys", icon: "🔑" },
    { key: "mcp", labelKey: "settings.tab.mcp", icon: "⌘" },
  ];
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="dim" style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>{t("settings.eyebrow")}</div>
      <h1 style={{ margin: "2px 0 4px" }}>{t("settings.title")}</h1>
      <p className="dim" style={{ marginTop: 0 }}>{t("settings.subtitle")}</p>

      <div className="chip-row" style={{ margin: "14px 0 18px" }}>
        {TABS.map((tb) => (
          <button key={tb.key} className={`chip${tab === tb.key ? " on" : ""}`} onClick={() => setTab(tb.key)}>
            {tb.icon} {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab initial={initial} />}
      {tab === "keys" && <KeysTab />}
      {tab === "mcp" && <McpTab />}
    </div>
  );
}

// ---------------- Profile ----------------
function ProfileTab({ initial }: { initial: SettingsInitial }) {
  const t = useT();
  const [name, setName] = useState(initial.displayName);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const db = browserClient();
      const { data } = await db.auth.getUser();
      if (!data.user) throw new Error("กรุณาเข้าสู่ระบบ");
      const { error } = await db.from("profiles").update({ display_name: name }).eq("id", data.user.id);
      if (error) throw error;
      setMsg(t("settings.profile.saved"));
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function resetPw() {
    if (!initial.email) return;
    const db = browserClient();
    await db.auth.resetPasswordForEmail(initial.email, { redirectTo: `${window.location.origin}/login` });
    setMsg(t("settings.profile.reset_sent"));
  }

  return (
    <>
      <div className="card">
        <h3>{t("settings.profile.title")}</h3>
        <p className="dim" style={{ marginTop: -4 }}>{t("settings.profile.desc")}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 16px" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>
            {(initial.displayName || initial.email || "?").slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="grid2">
          <div>
            <div className="label">{t("settings.profile.display_name")}</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="label">{t("settings.profile.email")}</div>
            <input className="input" value={initial.email ?? ""} disabled style={{ opacity: 0.6 }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button className="btn sm" onClick={resetPw}>{t("settings.profile.reset_pw")}</button>
          <button className="btn primary" onClick={save} disabled={busy || !isSupabaseConfigured()}>
            {busy ? t("settings.profile.saving") : t("settings.profile.save")}
          </button>
        </div>
        {msg && <p className="dim" style={{ marginTop: 10 }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>{t("settings.billing_hint_title")}</h3>
        <p className="dim" style={{ marginTop: -4 }}>{t("settings.billing_hint_desc")}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/credits" className="btn sm">{t("settings.billing_hint_credits")}</Link>
          <Link href="/pricing" className="btn sm">{t("settings.billing_hint_pricing")}</Link>
        </div>
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span>
          <b>{t("settings.help_title")}</b>
          <span className="dim" style={{ display: "block", fontSize: 13 }}>{t("settings.help_desc")}</span>
        </span>
        <a className="btn" href="mailto:support@creatorstudio.app">{t("settings.help_cta")}</a>
      </div>
    </>
  );
}

// ---------------- API Keys (real backend — Vault-backed, migration 0008) ----------------
const PROVIDERS: { key: ApiKeyProvider; label: string }[] = [
  { key: "pexels", label: "Pexels" },
  { key: "pixabay", label: "Pixabay" },
];

function KeysTab() {
  const t = useT();
  const [statusByProvider, setStatusByProvider] = useState<Record<string, ApiKeyStatus>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    try {
      const rows = await getApiKeyStatus(browserClient());
      setStatusByProvider(Object.fromEntries(rows.map((r) => [r.provider, r])));
    } catch { /* not signed in, or no keys yet */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(provider: ApiKeyProvider) {
    const secret = inputs[provider]?.trim();
    if (!secret) return;
    setBusy(provider);
    try {
      await saveApiKey(browserClient(), provider, secret);
      setInputs((p) => ({ ...p, [provider]: "" })); // never keep plaintext in state after save
      await load();
      setSavedFlash(provider);
      setTimeout(() => setSavedFlash(null), 2000);
    } catch { /* surfaced via status not refreshing */ } finally { setBusy(null); }
  }
  async function remove(provider: ApiKeyProvider) {
    setBusy(provider);
    try { await deleteApiKey(browserClient(), provider); await load(); } finally { setBusy(null); }
  }

  return (
    <div className="card">
      <h3>{t("settings.keys.title")}</h3>
      <p className="dim" style={{ marginTop: -4 }}>{t("settings.keys.desc")}</p>
      <div className="prompt-box" style={{ marginTop: 8, whiteSpace: "pre-line" }}>{t("settings.keys.managed")}</div>

      {!loading && PROVIDERS.map((p) => {
        const status = statusByProvider[p.key];
        return (
          <div key={p.key} style={{ marginTop: 14 }}>
            <div className="label">{p.label} API Key</div>
            {status ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <span>
                  <span className="prompt-box" style={{ padding: "4px 10px", display: "inline-block" }}>•••• {status.last4}</span>{" "}
                  <span className="pill" style={{ fontSize: 11, marginLeft: 6 }}>{status.status}</span>
                </span>
                <button className="btn sm" onClick={() => remove(p.key)} disabled={busy === p.key}>{t("settings.keys.delete")}</button>
              </div>
            ) : (
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>{t("settings.keys.no_key")}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input className="input" type="password" placeholder={t("settings.keys.placeholder")}
                value={inputs[p.key] ?? ""} onChange={(e) => setInputs((prev) => ({ ...prev, [p.key]: e.target.value }))} />
              <button className="btn primary" onClick={() => save(p.key)} disabled={busy === p.key || !inputs[p.key]?.trim()}>
                {savedFlash === p.key ? t("settings.keys.saved") : t("settings.keys.save")}
              </button>
            </div>
          </div>
        );
      })}
      <p className="dim" style={{ marginTop: 14, fontSize: 12 }}>{t("settings.keys.security_note")}</p>
    </div>
  );
}

// ---------------- Agent / MCP ----------------
function McpTab() {
  const t = useT();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  async function load() {
    const res = await fetch("/api/mcp-tokens");
    if (res.ok) setTokens((await res.json()).tokens ?? []);
    setLoading(false);
  }
  useEffect(() => { if (isSupabaseConfigured()) load(); else setLoading(false); }, []);
  async function create() {
    setError(null);
    const res = await fetch("/api/mcp-tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setFresh(data.token); setName(""); await load();
  }
  async function revoke(id: string) { await fetch(`/api/mcp-tokens?id=${id}`, { method: "DELETE" }); await load(); }

  return (
    <>
      <div className="card">
        <h3>{t("settings.mcp.title")}</h3>
        <p className="dim" style={{ marginTop: -4 }}>{t("settings.mcp.desc")}</p>
        <div className="label">{t("settings.mcp.endpoint")}</div>
        <div className="prompt-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{endpoint}</span>
          <button className="btn sm" onClick={() => navigator.clipboard.writeText(endpoint)}>{t("settings.mcp.copy")}</button>
        </div>
        <p className="dim" style={{ marginTop: 8 }}>{t("settings.mcp.tools_note")} generate_content_kit · generate_image · list_brands · get_credit_balance · create_campaign</p>
      </div>

      <div className="card">
        <div className="section-head"><h3>{t("settings.mcp.tokens_title")}</h3></div>
        {fresh && (
          <div className="card" style={{ borderColor: "var(--success)" }}>
            <b>{t("settings.mcp.new_token")}</b>
            <div className="prompt-box" style={{ marginTop: 6 }}>{fresh}</div>
            <button className="btn sm" style={{ marginTop: 6 }} onClick={() => navigator.clipboard.writeText(fresh)}>{t("settings.mcp.copy_token")}</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <input className="input" placeholder={t("settings.mcp.name_placeholder")} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" onClick={create} disabled={!isSupabaseConfigured()}>{t("settings.mcp.create")}</button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {loading ? <p className="dim">{t("settings.mcp.loading")}</p> : tokens.length === 0 ? (
          <p className="dim">{t("settings.mcp.no_tokens")}</p>
        ) : tokens.map((tk) => (
          <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: tk.revoked ? 0.5 : 1 }}>
            <div>
              <div>{tk.name} {tk.revoked && <span className="pill">{t("settings.mcp.revoked")}</span>}</div>
              <div className="dim" style={{ fontSize: 12 }}>
                {tk.last_used_at ? `${t("settings.mcp.last_used")} ${new Date(tk.last_used_at).toLocaleString("th-TH")}` : t("settings.mcp.never_used")}
              </div>
            </div>
            {!tk.revoked && <button className="btn sm" onClick={() => revoke(tk.id)}>{t("settings.mcp.revoke")}</button>}
          </div>
        ))}
      </div>
    </>
  );
}
