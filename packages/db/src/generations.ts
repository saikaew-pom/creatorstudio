// Persistence for AI generations (the universal asset table) + refine versions.
// Every generation stores {prompt_id, model, credits_spent, input} for reproducibility
// (BLUEPRINT P1/P5) and powers /history, reopen-via-?jobId, and Inspiration remix.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationRow, GenStatus } from "./types";

export interface NewGeneration {
  user_id: string;
  type: string; // content_kit | image | viral_kit | brainstorm | ...
  tool: string; // content_studio | image_studio | ...
  title?: string;
  input: unknown;
  output?: unknown;
  prompt_id: string;
  prompt_rendered?: string;
  model?: string;
  credits_spent?: number;
  asset_path?: string;
  status?: GenStatus;
  niche?: string;
  platform?: string[];
}

export async function insertGeneration(
  db: SupabaseClient,
  gen: NewGeneration
): Promise<GenerationRow> {
  const { data, error } = await db
    .from("generations")
    .insert({ status: "done", credits_spent: 0, ...gen })
    .select()
    .single();
  if (error) throw error;
  return data as GenerationRow;
}

export async function getGeneration(
  db: SupabaseClient,
  id: string
): Promise<GenerationRow | null> {
  const { data, error } = await db.from("generations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as GenerationRow) ?? null;
}

export async function listGenerations(
  db: SupabaseClient,
  opts: { type?: string; limit?: number } = {}
): Promise<GenerationRow[]> {
  let q = db.from("generations").select("*").order("created_at", { ascending: false });
  if (opts.type) q = q.eq("type", opts.type);
  q = q.limit(opts.limit ?? 30);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GenerationRow[];
}

/** Update a generation's output (e.g. after a refine) and record the prior output
 * as a version row so undo is possible (doc 03 §3). */
export async function saveRefinedOutput(
  db: SupabaseClient,
  generationId: string,
  newOutput: unknown,
  instruction: string
): Promise<void> {
  const { data: current, error: readErr } = await db
    .from("generations")
    .select("output")
    .eq("id", generationId)
    .single();
  if (readErr) throw readErr;

  const { error: verErr } = await db.from("generation_versions").insert({
    generation_id: generationId,
    output: (current as { output: unknown }).output,
    instruction,
  });
  if (verErr) throw verErr;

  const { error: updErr } = await db
    .from("generations")
    .update({ output: newOutput, updated_at: new Date().toISOString() })
    .eq("id", generationId);
  if (updErr) throw updErr;
}
