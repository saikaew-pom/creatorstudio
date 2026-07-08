// Hand-written Database types covering the tables the apps use through M1-M2.
// When the Supabase CLI is available, replace with: `supabase gen types typescript`.
// Kept focused (not every column) — expand as later milestones touch more tables.

export type Plan = "free" | "pro" | "business";
export type CreditBucket = "purchased" | "monthly";
export type CreditKind = "purchase" | "monthly_grant" | "spend" | "refund" | "gift";
export type GenStatus = "queued" | "running" | "done" | "failed";
export type ApiProvider = "pexels" | "pixabay" | "gemini" | "elevenlabs";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  workspace_name: string | null;
  plan: Plan;
  plan_renews_at: string | null;
  streak_days: number;
  last_active_date: string | null;
  active_brand_id: string | null;
  preferred_model: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface GenerationRow {
  id: string;
  user_id: string;
  type: string;
  tool: string;
  title: string | null;
  input: unknown;
  output: unknown;
  prompt_id: string;
  prompt_rendered: string | null;
  model: string | null;
  credits_spent: number;
  asset_path: string | null;
  status: GenStatus;
  error: string | null;
  niche: string | null;
  platform: string[] | null;
  scheduled_date: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationVersionRow {
  id: string;
  generation_id: string;
  output: unknown;
  instruction: string | null;
  created_at: string;
}

export interface CreditTxnRow {
  id: string;
  user_id: string;
  amount: number;
  kind: CreditKind;
  bucket: CreditBucket;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

export interface ModelCostRow {
  key: string;
  credits: number;
  label_th: string;
}

export interface UserApiKeyRow {
  id: string;
  user_id: string;
  provider: ApiProvider;
  secret_id: string;
  status: "unverified" | "valid" | "invalid";
  last_tested_at: string | null;
  created_at: string;
}
