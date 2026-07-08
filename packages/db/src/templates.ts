// Template library reads (doc 03 §6). Templates are public-read (is_published=true)
// with admin-write; the record shape/master_prompt live in @cs/prompts (doc 02 §T).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormField } from "@cs/prompts";

export interface TemplateRow {
  slug: string;
  kind: "visual" | "viral";
  name_th: string;
  category: string;
  badges: ("hot" | "new" | "featured")[];
  usage_count: number;
  aspect: string | null;
  uses_brand_kit: boolean;
  renders_thai_text: boolean;
  example_asset: string | null;
  form: FormField[];
  master_prompt: string;
  output_blocks: unknown;
  output_schema: unknown;
  is_published: boolean;
}

export async function listTemplates(
  db: SupabaseClient,
  kind?: "visual" | "viral"
): Promise<TemplateRow[]> {
  let q = db.from("templates").select("*").eq("is_published", true);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.order("usage_count", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TemplateRow[];
}

export async function getTemplate(db: SupabaseClient, slug: string): Promise<TemplateRow | null> {
  const { data, error } = await db.from("templates").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as TemplateRow) ?? null;
}

/** Increment usage_count via RPC (bumps only on successful generation, doc 03 §8). */
export async function incrementTemplateUsage(db: SupabaseClient, slug: string): Promise<void> {
  const { error } = await db.rpc("increment_template_usage", { p_slug: slug });
  if (error) throw error;
}
