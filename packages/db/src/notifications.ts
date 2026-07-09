// In-app notifications (doc 01 §10). The worker writes render_done/export_done rows;
// the bell reads them. Session-scoped client (RLS: own rows).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface NotificationRow {
  id: string;
  app: "content" | "studio";
  kind: string;
  title_th: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export async function listNotifications(db: SupabaseClient, limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, app, kind, title_th, link, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationsRead(db: SupabaseClient, ids?: string[]): Promise<void> {
  let q = db.from("notifications").update({ read: true }).eq("read", false);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
}
