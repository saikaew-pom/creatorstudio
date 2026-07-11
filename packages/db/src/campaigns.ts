// Campaign Mode persistence (M15b, migration 0007_campaigns.sql).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayPlan } from "@cs/prompts";

export interface CampaignRow {
  id: string;
  user_id: string;
  topic: string;
  niche: string | null;
  days: DayPlan[];
  credits_spent: number;
  created_at: string;
}

export async function insertCampaign(
  db: SupabaseClient,
  opts: { user_id: string; topic: string; niche?: string; days: DayPlan[]; credits_spent: number }
): Promise<CampaignRow> {
  const { data, error } = await db
    .from("campaigns")
    .insert({
      user_id: opts.user_id, topic: opts.topic, niche: opts.niche ?? null,
      days: opts.days, credits_spent: opts.credits_spent,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CampaignRow;
}

export async function listCampaigns(db: SupabaseClient): Promise<CampaignRow[]> {
  const { data, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CampaignRow[];
}

export async function getCampaign(db: SupabaseClient, id: string): Promise<CampaignRow | null> {
  const { data, error } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CampaignRow | null;
}
