// Active-workspace resolution + the work_crm entitlement gate (docs/07-work-crm.md
// §1, M9). The active workspace is a plain cookie (no server-side session table needed
// — membership is re-checked against the DB on every read anyway via RLS/ws_role, so
// the cookie is just "which of my workspaces am I looking at", never a trust boundary).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getMyRole, hasFeature, listMyWorkspaces, type MyWorkspace,
} from "@cs/db";
import { getServerSupabase, getUserId, isSupabaseConfigured } from "./supabase-server";

export const ACTIVE_WS_COOKIE = "cs_ws";

/** Shared options for setting the active-workspace cookie (switch route, invite
 * accept route) — httpOnly (no JS access needed) and secure outside local dev. */
export const ACTIVE_WS_COOKIE_OPTIONS = {
  path: "/", httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};

export interface ActiveWorkspace {
  userId: string;
  workspace: MyWorkspace;
  memberships: MyWorkspace[];
}

/** Resolves the signed-in user's active workspace: the cookie pick if it's still one
 * of their memberships, else their oldest (personal) workspace. Null if signed out,
 * unconfigured, or (shouldn't happen — bootstrap always creates one) memberless. */
export async function getActiveWorkspace(): Promise<ActiveWorkspace | null> {
  if (!isSupabaseConfigured()) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const db = getServerSupabase();
  const memberships = await listMyWorkspaces(db, userId);
  if (memberships.length === 0) return null;

  const picked = cookies().get(ACTIVE_WS_COOKIE)?.value;
  const workspace = memberships.find((w) => w.id === picked) ?? memberships[0];
  return { userId, workspace, memberships };
}

export type WorkspaceContext =
  | { kind: "signed-out" }
  | { kind: "no-workspace" }
  | { kind: "ok"; active: ActiveWorkspace };

/** Distinguishes "not signed in" from "signed in but somehow memberless" — the
 * latter shouldn't happen (the signup trigger always creates a personal
 * workspace) but showing a "please log in" prompt to an already-logged-in user
 * would be a confusing dead end, so callers that render a page (not just gate a
 * feature) should use this instead of the raw `getActiveWorkspace() === null`. */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const active = await getActiveWorkspace();
  if (active) return { kind: "ok", active };
  const userId = await getUserId();
  return userId ? { kind: "no-workspace" } : { kind: "signed-out" };
}

export type FeatureGate = WorkspaceContext | { kind: "not-entitled"; active: ActiveWorkspace };

/** The M9 access gate: a workspace only sees Work/CRM once an admin grants
 * `work_crm` (docs/07 §1.3). Use this in every page and /api/work|crm route —
 * pages render an upsell/empty state on non-ok, API routes should 403. */
export async function requireFeature(feature: string): Promise<FeatureGate> {
  const ctx = await getWorkspaceContext();
  if (ctx.kind !== "ok") return ctx;
  const db = getServerSupabase();
  const entitled = await hasFeature(db, ctx.active.workspace.id, feature);
  return entitled ? { kind: "ok", active: ctx.active } : { kind: "not-entitled", active: ctx.active };
}

/** Re-derives role from the DB rather than trusting the cached MyWorkspace.role —
 * use before privileged actions (invite, remove member) since role can change
 * between page load and the mutation. */
export async function getCurrentRole(wsId: string): Promise<string | null> {
  const db = getServerSupabase();
  return getMyRole(db, wsId);
}

/** requireFeature() for API routes: null when entitled (proceed), otherwise the
 * 401/403 response to return immediately — the M9 accept criterion ("a workspace
 * without work_crm gets 403 from every /api/work|crm route") that M10 fulfills by
 * actually having such routes to gate. */
export async function requireFeatureRoute(
  feature: string
): Promise<{ active: ActiveWorkspace; response: null } | { active: null; response: NextResponse }> {
  const gate = await requireFeature(feature);
  if (gate.kind === "ok") return { active: gate.active, response: null };
  if (gate.kind === "signed-out")
    return { active: null, response: NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }) };
  if (gate.kind === "no-workspace")
    return { active: null, response: NextResponse.json({ error: "ไม่พบ workspace ของคุณ" }, { status: 403 }) };
  return { active: null, response: NextResponse.json({ error: "workspace นี้ยังไม่เปิดใช้งาน Work + CRM" }, { status: 403 }) };
}
