// Video-studio persistence (doc 03 §5): projects, render jobs, captions, minute usage.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  mode: "script" | "upload";
  script: string | null;
  segments: unknown;
  elements: unknown;
  status: "draft" | "rendering" | "rendered" | "exporting" | "exported";
  created_at: string;
  updated_at: string;
}

export interface RenderJobRow {
  id: string;
  project_id: string;
  user_id: string;
  kind: "preview_render" | "export";
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  step_label: string | null;
  minutes_charged: number | null;
  result_path: string | null;
  error: string | null;
  payload: unknown;
  created_at: string;
}

export async function listProjects(db: SupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await db.from("projects").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function getProject(db: SupabaseClient, id: string): Promise<ProjectRow | null> {
  const { data, error } = await db.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ProjectRow) ?? null;
}

export async function upsertProject(
  db: SupabaseClient,
  userId: string,
  p: { id?: string; name?: string; mode?: "script" | "upload"; script?: string; segments?: unknown; elements?: unknown; status?: ProjectRow["status"] }
): Promise<ProjectRow> {
  const row = { user_id: userId, updated_at: new Date().toISOString(), ...p };
  const { data, error } = await db.from("projects").upsert(row).select().single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function enqueueRenderJob(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  kind: "preview_render" | "export",
  payload: unknown,
  minutesCharged: number
): Promise<RenderJobRow> {
  const { data, error } = await db
    .from("render_jobs")
    .insert({ user_id: userId, project_id: projectId, kind, payload, minutes_charged: minutesCharged, status: "queued" })
    .select()
    .single();
  if (error) throw error;
  return data as RenderJobRow;
}

export async function updateJobProgress(
  db: SupabaseClient,
  jobId: string,
  progress: number,
  stepLabel: string
): Promise<void> {
  await db.from("render_jobs").update({ progress, step_label: stepLabel, status: "running", updated_at: new Date().toISOString() }).eq("id", jobId);
}

export async function finishJob(
  db: SupabaseClient,
  jobId: string,
  resultPath: string
): Promise<void> {
  // Clear any error from a prior failed attempt so a re-run reports cleanly.
  await db.from("render_jobs").update({ status: "done", progress: 100, step_label: "เสร็จแล้ว", result_path: resultPath, error: null, updated_at: new Date().toISOString() }).eq("id", jobId);
}

export async function failJob(db: SupabaseClient, jobId: string, error: string): Promise<void> {
  await db.from("render_jobs").update({ status: "failed", error, updated_at: new Date().toISOString() }).eq("id", jobId);
}

export async function saveCaptions(
  db: SupabaseClient,
  projectId: string,
  cards: unknown,
  style: unknown = {}
): Promise<void> {
  // Requires the unique(project_id) constraint from migration 0004 for the upsert.
  // NB: check the error — an earlier version swallowed it and captions silently
  // never saved (the render "succeeded" with zero cards).
  const { error } = await db
    .from("captions")
    .upsert({ project_id: projectId, cards, style, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) throw error;
}

// ---------- Minutes (doc 03 §5 / doc 04 §11) ----------
export async function getMinutesUsedThisMonth(db: SupabaseClient, userId: string): Promise<number> {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data } = await db.from("minute_usage").select("minutes_used").eq("user_id", userId).eq("month", month).maybeSingle();
  return (data?.minutes_used as number) ?? 0;
}

/** Add minutes to this month's usage. Must use a service-role client — minute_usage
 * is select-only under RLS (writes go through trusted server code only, like credits). */
export async function addMinutes(adminDb: SupabaseClient, userId: string, minutes: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const current = await getMinutesUsedThisMonth(adminDb, userId);
  await adminDb.from("minute_usage").upsert(
    { user_id: userId, month, minutes_used: current + minutes },
    { onConflict: "user_id,month" }
  );
}

/** Plan monthly video-minute allowances (doc 01 §9). */
export const MINUTE_LIMITS: Record<string, number> = { free: 5, pro: 80, business: 150 };
