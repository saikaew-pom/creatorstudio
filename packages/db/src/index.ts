export * from "./types";
export * from "./client";
export * from "./credits";
export * from "./generations";
export * from "./storage";
export * from "./brands";
export * from "./templates";
export * from "./projects";
export * from "./mcp";
export * from "./notifications";
export * from "./campaigns";
export * from "./api-keys";
export * from "./workspaces";
export * from "./work";
export * from "./crm";

/** Daily free-quota limits per plan (doc 01 §9). Enforced via tryConsumeDailyUse. */
export const DAILY_LIMITS: Record<string, number> = {
  free: 30,
  pro: 100,
  business: 300,
};
