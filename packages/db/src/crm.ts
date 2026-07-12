// CRM module — brand deals & sponsorships (docs/07-work-crm.md §3,
// migration 0015_crm.sql). Same workspace_id + work_crm entitlement RLS
// discipline as packages/db/src/work.ts — these are thin wrappers, the DB is
// deny-by-default regardless of what the app-layer requireFeature guard does.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DealActivityKind = "note" | "call" | "email" | "meeting" | "stage_change" | "amount_change" | "ai_draft";
export type DeliverableKind = "content_kit" | "image" | "video" | "post" | "other";
export type DeliverableStatus = "todo" | "in_production" | "in_review" | "approved" | "published";

export interface CompanyRow {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  logo_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: string;
  workspace_id: string;
  company_id: string | null;
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface StageRow {
  id: string;
  workspace_id: string;
  name_th: string;
  key: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface DealRow {
  id: string;
  workspace_id: string;
  title: string;
  company_id: string | null;
  company_name: string | null;
  primary_contact_id: string | null;
  contact_name: string | null;
  stage_id: string;
  stage_key: string | null;
  stage_name: string | null;
  stage_is_won: boolean;
  stage_is_lost: boolean;
  owner_id: string | null;
  owner_name: string | null;
  amount_thb: number | null;
  probability: number | null;
  expected_close: string | null;
  source: string | null;
  brand_id: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DealActivityRow {
  id: string;
  deal_id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: DealActivityKind;
  body: string | null;
  detail: Record<string, unknown>;
  occurred_at: string;
}

export interface DeliverableRow {
  id: string;
  workspace_id: string;
  deal_id: string;
  kind: DeliverableKind;
  title: string;
  status: DeliverableStatus;
  due_date: string | null;
  generation_id: string | null;
  project_id: string | null;
  task_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------- companies ----
export async function listCompanies(db: SupabaseClient, wsId: string): Promise<CompanyRow[]> {
  const { data, error } = await db
    .from("crm_companies").select("*").eq("workspace_id", wsId).order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}

export async function getCompany(db: SupabaseClient, id: string): Promise<CompanyRow | null> {
  const { data, error } = await db.from("crm_companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CompanyRow | null;
}

export async function createCompany(
  db: SupabaseClient, wsId: string,
  opts: { name: string; website?: string | null; industry?: string | null; notes?: string | null }
): Promise<CompanyRow> {
  const { data, error } = await db
    .from("crm_companies")
    .insert({ workspace_id: wsId, name: opts.name, website: opts.website ?? null, industry: opts.industry ?? null, notes: opts.notes ?? null })
    .select("*").single();
  if (error) throw error;
  return data as CompanyRow;
}

export async function updateCompany(
  db: SupabaseClient, id: string,
  patch: Partial<{ name: string; website: string | null; industry: string | null; logo_path: string | null; notes: string | null }>
): Promise<void> {
  const { data, error } = await db.from("crm_companies").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("company not found");
}

export async function deleteCompany(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from("crm_companies").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("company not found");
}

// --------------------------------------------------------------- contacts ----
export async function listContacts(db: SupabaseClient, wsId: string, companyId?: string): Promise<ContactRow[]> {
  let q = db.from("crm_contacts").select("*").eq("workspace_id", wsId);
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContactRow[];
}

export async function createContact(
  db: SupabaseClient, wsId: string,
  opts: { name: string; company_id?: string | null; role_title?: string | null; email?: string | null; phone?: string | null; line_id?: string | null }
): Promise<ContactRow> {
  const { data, error } = await db
    .from("crm_contacts")
    .insert({
      workspace_id: wsId, name: opts.name, company_id: opts.company_id ?? null,
      role_title: opts.role_title ?? null, email: opts.email ?? null, phone: opts.phone ?? null, line_id: opts.line_id ?? null,
    })
    .select("*").single();
  if (error) throw error;
  return data as ContactRow;
}

export async function updateContact(
  db: SupabaseClient, id: string,
  patch: Partial<{ company_id: string | null; name: string; role_title: string | null; email: string | null; phone: string | null; line_id: string | null; notes: string | null }>
): Promise<void> {
  const { data, error } = await db.from("crm_contacts").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("contact not found");
}

export async function deleteContact(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from("crm_contacts").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("contact not found");
}

// ----------------------------------------------------------------- stages ----
export async function listStages(db: SupabaseClient, wsId: string): Promise<StageRow[]> {
  const { data, error } = await db
    .from("deal_stages").select("*").eq("workspace_id", wsId).order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StageRow[];
}

/** Idempotent — safe to call every time the CRM is opened for a workspace. */
export async function seedDefaultStages(db: SupabaseClient, wsId: string): Promise<void> {
  const { error } = await db.rpc("seed_default_stages", { p_ws: wsId });
  if (error) throw error;
}

// ------------------------------------------------------------------- deals ---
type DealJoinRow = Omit<DealRow, "company_name" | "contact_name" | "stage_key" | "stage_name" | "stage_is_won" | "stage_is_lost" | "owner_name"> & {
  crm_companies: { name: string } | null;
  crm_contacts: { name: string } | null;
  deal_stages: { name_th: string; key: string; is_won: boolean; is_lost: boolean } | null;
  profiles: { display_name: string | null } | null;
};

function withDealJoins(row: DealJoinRow): DealRow {
  const { crm_companies, crm_contacts, deal_stages, profiles, ...rest } = row;
  return {
    ...rest,
    company_name: crm_companies?.name ?? null,
    contact_name: crm_contacts?.name ?? null,
    stage_key: deal_stages?.key ?? null,
    stage_name: deal_stages?.name_th ?? null,
    stage_is_won: deal_stages?.is_won ?? false,
    stage_is_lost: deal_stages?.is_lost ?? false,
    owner_name: profiles?.display_name ?? null,
  };
}

const DEAL_SELECT = "*, crm_companies(name), crm_contacts(name), deal_stages(name_th, key, is_won, is_lost), profiles(display_name)";

export async function listDeals(db: SupabaseClient, wsId: string): Promise<DealRow[]> {
  const { data, error } = await db
    .from("deals").select(DEAL_SELECT).eq("workspace_id", wsId).order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => withDealJoins(r as unknown as DealJoinRow));
}

export async function getDeal(db: SupabaseClient, id: string): Promise<DealRow | null> {
  const { data, error } = await db.from("deals").select(DEAL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? withDealJoins(data as unknown as DealJoinRow) : null;
}

export async function createDeal(
  db: SupabaseClient,
  opts: {
    workspace_id: string; title: string; stage_id: string; company_id?: string | null;
    primary_contact_id?: string | null; owner_id?: string | null; amount_thb?: number | null;
    probability?: number | null; expected_close?: string | null; source?: string | null;
  }
): Promise<DealRow> {
  const { data, error } = await db
    .from("deals")
    .insert({
      workspace_id: opts.workspace_id, title: opts.title, stage_id: opts.stage_id,
      company_id: opts.company_id ?? null, primary_contact_id: opts.primary_contact_id ?? null,
      owner_id: opts.owner_id ?? null, amount_thb: opts.amount_thb ?? null,
      probability: opts.probability ?? null, expected_close: opts.expected_close ?? null, source: opts.source ?? null,
    })
    .select(DEAL_SELECT).single();
  if (error) throw error;
  return withDealJoins(data as unknown as DealJoinRow);
}

/** Generic field edit — NOT for stage/position (use reorderDeal, which goes
 * through the reorder_deal RPC for fractional-position + advisory-lock safety
 * and the audited stage_change activity row). */
export async function updateDeal(
  db: SupabaseClient, id: string,
  patch: Partial<{
    title: string; company_id: string | null; primary_contact_id: string | null; owner_id: string | null;
    amount_thb: number | null; probability: number | null; expected_close: string | null; source: string | null; notes: string | null;
  }>
): Promise<void> {
  const { data, error } = await db.from("deals").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("deal not found");
}

export async function deleteDeal(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from("deals").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("deal not found");
}

/** Moves a deal to `stageId` at the midpoint of (prevDealId, nextDealId) —
 * advisory-locked + fractional on the DB side, audits a stage_change row. */
export async function reorderDeal(
  db: SupabaseClient, dealId: string, stageId: string, prevDealId: string | null, nextDealId: string | null
): Promise<number> {
  const { data, error } = await db.rpc("reorder_deal", {
    p_deal: dealId, p_stage: stageId, p_prev: prevDealId, p_next: nextDealId,
  });
  if (error) throw error;
  return Number(data);
}

// -------------------------------------------------------------- activity ----
type ActivityJoinRow = Omit<DealActivityRow, "actor_name"> & { profiles: { display_name: string | null } | null };

export async function listDealActivity(db: SupabaseClient, dealId: string): Promise<DealActivityRow[]> {
  const { data, error } = await db
    .from("deal_activities")
    .select("id, deal_id, workspace_id, actor_id, kind, body, detail, occurred_at, profiles(display_name)")
    .eq("deal_id", dealId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => {
    const row = m as unknown as ActivityJoinRow;
    return { ...row, actor_name: row.profiles?.display_name ?? null };
  });
}

/** Manual log entry only — RLS's activity_insert policy rejects any kind other
 * than note/call/email/meeting (stage_change/amount_change come from the
 * trigger; ai_draft is a future M12 server-side write). */
export async function addDealActivity(
  db: SupabaseClient, dealId: string, wsId: string, kind: "note" | "call" | "email" | "meeting", body: string
): Promise<DealActivityRow> {
  const { data, error } = await db
    .from("deal_activities")
    .insert({ deal_id: dealId, workspace_id: wsId, kind, body })
    .select("id, deal_id, workspace_id, actor_id, kind, body, detail, occurred_at, profiles(display_name)")
    .single();
  if (error) throw error;
  const row = data as unknown as ActivityJoinRow;
  return { ...row, actor_name: row.profiles?.display_name ?? null };
}

// ----------------------------------------------------------- deliverables ----
export async function listDeliverables(db: SupabaseClient, dealId: string): Promise<DeliverableRow[]> {
  const { data, error } = await db
    .from("deliverables").select("*").eq("deal_id", dealId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliverableRow[];
}

export async function createDeliverable(
  db: SupabaseClient,
  opts: {
    workspace_id: string; deal_id: string; kind: DeliverableKind; title: string; due_date?: string | null;
    generation_id?: string | null; project_id?: string | null; task_id?: string | null; owner_user_id?: string | null;
  }
): Promise<DeliverableRow> {
  const { data, error } = await db
    .from("deliverables")
    .insert({
      workspace_id: opts.workspace_id, deal_id: opts.deal_id, kind: opts.kind, title: opts.title,
      due_date: opts.due_date ?? null, generation_id: opts.generation_id ?? null, project_id: opts.project_id ?? null,
      task_id: opts.task_id ?? null, owner_user_id: opts.owner_user_id ?? null,
    })
    .select("*").single();
  if (error) throw error;
  return data as DeliverableRow;
}

export async function updateDeliverable(
  db: SupabaseClient, id: string,
  patch: Partial<{ kind: DeliverableKind; title: string; status: DeliverableStatus; due_date: string | null }>
): Promise<void> {
  const { data, error } = await db.from("deliverables").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("deliverable not found");
}

export async function deleteDeliverable(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from("deliverables").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("deliverable not found");
}

/** Re-links (or clears) a deliverable's studio asset — generation_id/project_id/
 * owner_user_id set together, since exactly one of the first two (or neither)
 * is ever set per deliverable. The caller must already have verified ownership
 * of the asset being linked (getGeneration/getProject) before calling this —
 * the DB's enforce_deliverable_asset_ownership trigger (0016) is the real
 * backstop either way. Throws on a DB error AND if the id doesn't match a row
 * the caller can see (RLS-filtered or nonexistent) — same "don't report ok on
 * a silent no-op" discipline as every other wrapper in this file. */
export async function updateDeliverableLink(
  db: SupabaseClient, id: string,
  link: { generation_id: string | null; project_id: string | null; owner_user_id: string | null }
): Promise<void> {
  const { data, error } = await db.from("deliverables").update(link).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("deliverable not found");
}

// ---------------------------------------------------------------- funnel ----
export interface FunnelStageTotal {
  stage_id: string;
  stage_name: string;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  amount_thb: number;
}

/** Pure aggregation (no DB call) — sums amount_thb per stage, in stage order.
 * Mirrors computeWorkload's style in work.ts: the inputs are already
 * RLS-readable to the caller, so there's no need for a bespoke SQL aggregate. */
export function computeFunnelTotals(stages: StageRow[], deals: DealRow[]): FunnelStageTotal[] {
  const byStage = new Map<string, DealRow[]>();
  for (const d of deals) {
    const list = byStage.get(d.stage_id) ?? [];
    list.push(d);
    byStage.set(d.stage_id, list);
  }
  return stages.map((s) => {
    const inStage = byStage.get(s.id) ?? [];
    return {
      stage_id: s.id,
      stage_name: s.name_th,
      is_won: s.is_won,
      is_lost: s.is_lost,
      count: inStage.length,
      amount_thb: inStage.reduce((sum, d) => sum + (d.amount_thb ?? 0), 0),
    };
  });
}
