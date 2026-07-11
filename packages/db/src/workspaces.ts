// Team workspaces — membership, invites, entitlement (docs/07-work-crm.md §1,
// migration 0005_workspaces.sql). Membership/invite/entitlement mutations all go
// through the security-definer RPCs; the tables themselves only allow direct reads.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface MyWorkspace extends WorkspaceRow {
  role: "owner" | "admin" | "member" | "guest";
}

export interface MemberRow {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "guest";
  status: "active" | "removed";
  capacity_hours: number;
  invited_by: string | null;
  created_at: string;
  display_name: string | null;
}

export interface InviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member" | "guest";
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

/** Workspaces the caller belongs to, with their role in each — RLS already scopes
 * `workspaces` to member rows (ws_read policy), so this is a plain select + a
 * self-scoped membership lookup merged in. */
export async function listMyWorkspaces(db: SupabaseClient, userId: string): Promise<MyWorkspace[]> {
  const [{ data: workspaces, error: wErr }, { data: memberships, error: mErr }] = await Promise.all([
    db.from("workspaces").select("*").order("created_at", { ascending: true }),
    db.from("workspace_members").select("workspace_id, role").eq("user_id", userId).eq("status", "active"),
  ]);
  if (wErr) throw wErr;
  if (mErr) throw mErr;
  const roleByWs = new Map((memberships ?? []).map((m) => [m.workspace_id as string, m.role as string]));
  return (workspaces ?? [])
    .map((w) => ({ ...(w as WorkspaceRow), role: (roleByWs.get(w.id) ?? "member") as MyWorkspace["role"] }));
}

export async function getWorkspace(db: SupabaseClient, wsId: string): Promise<WorkspaceRow | null> {
  const { data, error } = await db.from("workspaces").select("*").eq("id", wsId).maybeSingle();
  if (error) throw error;
  return data as WorkspaceRow | null;
}

/** Creates a new team workspace with the caller as owner (ws_insert RLS: owner_id = auth.uid());
 * the on_workspace_created trigger adds the owner membership row. */
export async function createWorkspace(db: SupabaseClient, name: string, ownerId: string): Promise<WorkspaceRow> {
  const { data, error } = await db.from("workspaces").insert({ name, owner_id: ownerId }).select("*").single();
  if (error) throw error;
  return data as WorkspaceRow;
}

export async function getMyRole(db: SupabaseClient, wsId: string): Promise<string | null> {
  const { data, error } = await db.rpc("ws_role", { p_ws: wsId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function hasFeature(db: SupabaseClient, wsId: string, feature: string): Promise<boolean> {
  const { data, error } = await db.rpc("ws_has_feature", { p_ws: wsId, p_feature: feature });
  if (error) throw error;
  return Boolean(data);
}

/** Active members with their display name — requires migration 0009's teammate
 * profile-read policy, since `profiles` is otherwise self-only under RLS. */
export async function listMembers(db: SupabaseClient, wsId: string): Promise<MemberRow[]> {
  const { data, error } = await db
    .from("workspace_members")
    // workspace_members has TWO fks into profiles (user_id, invited_by), so the
    // embed is ambiguous unless the fk constraint name disambiguates it.
    .select(
      "workspace_id, user_id, role, status, capacity_hours, invited_by, created_at, profiles!workspace_members_user_id_fkey(display_name)"
    )
    .eq("workspace_id", wsId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => {
    const row = m as unknown as MemberRow & { profiles: { display_name: string | null } | { display_name: string | null }[] | null };
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { ...row, display_name: profile?.display_name ?? null };
  });
}

export async function addMember(
  db: SupabaseClient, wsId: string, userId: string, role: "admin" | "member" | "guest" = "member"
): Promise<void> {
  const { error } = await db.rpc("add_member", { p_ws: wsId, p_user: userId, p_role: role });
  if (error) throw error;
}

export async function setMemberRole(
  db: SupabaseClient, wsId: string, userId: string, role: "admin" | "member" | "guest"
): Promise<void> {
  const { error } = await db.rpc("set_member_role", { p_ws: wsId, p_user: userId, p_role: role });
  if (error) throw error;
}

export async function removeMember(db: SupabaseClient, wsId: string, userId: string): Promise<void> {
  const { error } = await db.rpc("remove_member", { p_ws: wsId, p_user: userId });
  if (error) throw error;
}

export async function leaveWorkspace(db: SupabaseClient, wsId: string): Promise<void> {
  const { error } = await db.rpc("leave_workspace", { p_ws: wsId });
  if (error) throw error;
}

/** Creates/refreshes a pending invite and returns its token — the caller emails
 * "<work-app>/invite?token=<token>" (see apps/work/app/api/workspaces/[id]/invites). */
export async function createInvite(
  db: SupabaseClient, wsId: string, email: string, role: "admin" | "member" | "guest" = "member"
): Promise<string> {
  const { data, error } = await db.rpc("create_invite", { p_ws: wsId, p_email: email, p_role: role });
  if (error) throw error;
  return data as string;
}

export async function acceptInvite(db: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_invite", { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function listPendingInvites(db: SupabaseClient, wsId: string): Promise<InviteRow[]> {
  const { data, error } = await db
    .from("workspace_invites")
    .select("id, workspace_id, email, role, invited_by, accepted_at, created_at")
    .eq("workspace_id", wsId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

/** How many invites this workspace has created since `sinceIso` — a crude
 * per-workspace rate limit for create_invite (which also fires a real Supabase
 * auth email), not a general-purpose analytics query. */
export async function countInvitesSince(db: SupabaseClient, wsId: string, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from("workspace_invites")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

/** Platform-admin only (profiles.role = 'admin', enforced by the RPC itself). */
export async function grantFeature(
  db: SupabaseClient, wsId: string, feature: string, expiresAt?: string | null
): Promise<void> {
  const { error } = await db.rpc("grant_feature", { p_ws: wsId, p_feature: feature, p_expires: expiresAt ?? null });
  if (error) throw error;
}

export async function revokeFeature(db: SupabaseClient, wsId: string, feature: string): Promise<void> {
  const { error } = await db.rpc("revoke_feature", { p_ws: wsId, p_feature: feature });
  if (error) throw error;
}

export interface AdminWorkspaceRow extends WorkspaceRow {
  owner_name: string | null;
  member_count: number;
  entitlements: { feature: string; expires_at: string | null }[];
}

/** Platform-admin overview: ALL workspaces regardless of membership, so this must
 * be called with adminClient() (service role) — a platform admin is often not a
 * member of the workspace they're granting access to. Never expose this query
 * path to a session-scoped client. */
export async function adminListWorkspaces(admin: SupabaseClient): Promise<AdminWorkspaceRow[]> {
  const { data, error } = await admin
    .from("workspaces")
    .select(
      "*, profiles!owner_id(display_name), workspace_entitlements(feature, expires_at), workspace_members(user_id)"
    )
    .eq("workspace_members.status", "active") // exclude soft-removed members from the count
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w) => {
    const row = w as unknown as WorkspaceRow & {
      profiles: { display_name: string | null } | null;
      workspace_entitlements: { feature: string; expires_at: string | null }[];
      workspace_members: { user_id: string }[];
    };
    return {
      ...row,
      owner_name: row.profiles?.display_name ?? null,
      member_count: row.workspace_members?.length ?? 0,
      entitlements: row.workspace_entitlements ?? [],
    };
  });
}
