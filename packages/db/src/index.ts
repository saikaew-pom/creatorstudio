export * from "./types";
export * from "./client";
export * from "./credits";
export * from "./generations";

/** Daily free-quota limits per plan (doc 01 §9). Enforced via tryConsumeDailyUse. */
export const DAILY_LIMITS: Record<string, number> = {
  free: 30,
  pro: 100,
  business: 300,
};
