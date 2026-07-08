// Brand Voice + Style Clone persistence (doc 03 §2). Both store the AI-extracted
// profile JSON that gets injected as BRAND_BLOCK / STYLE_BLOCK into generation prompts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand, StyleProfile } from "@cs/prompts";

export interface BrandRow {
  id: string;
  user_id: string;
  name: string;
  data: Brand;
  assets: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface StyleRow {
  id: string;
  user_id: string;
  name: string;
  profile: StyleProfile;
  source_samples: string[] | null;
  created_at: string;
}

// ---------- Brands ----------
export async function listBrands(db: SupabaseClient): Promise<BrandRow[]> {
  const { data, error } = await db.from("brands").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandRow[];
}

export async function getBrand(db: SupabaseClient, id: string): Promise<BrandRow | null> {
  const { data, error } = await db.from("brands").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as BrandRow) ?? null;
}

export async function insertBrand(
  db: SupabaseClient,
  userId: string,
  name: string,
  data: Brand,
  assets: Record<string, unknown> = {}
): Promise<BrandRow> {
  const { data: row, error } = await db
    .from("brands")
    .insert({ user_id: userId, name, data, assets })
    .select()
    .single();
  if (error) throw error;
  return row as BrandRow;
}

export async function updateBrand(
  db: SupabaseClient,
  id: string,
  patch: Partial<Pick<BrandRow, "name" | "data" | "assets">>
): Promise<void> {
  const { error } = await db.from("brands").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteBrand(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("brands").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Styles ----------
export async function listStyles(db: SupabaseClient): Promise<StyleRow[]> {
  const { data, error } = await db.from("styles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StyleRow[];
}

export async function getStyle(db: SupabaseClient, id: string): Promise<StyleRow | null> {
  const { data, error } = await db.from("styles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as StyleRow) ?? null;
}

export async function insertStyle(
  db: SupabaseClient,
  userId: string,
  name: string,
  profile: StyleProfile,
  sourceSamples: string[]
): Promise<StyleRow> {
  const { data: row, error } = await db
    .from("styles")
    .insert({ user_id: userId, name, profile, source_samples: sourceSamples })
    .select()
    .single();
  if (error) throw error;
  return row as StyleRow;
}

export async function deleteStyle(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("styles").delete().eq("id", id);
  if (error) throw error;
}
