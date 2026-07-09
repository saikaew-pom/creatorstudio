// Storage helpers for the `generations` bucket (public, image/* only, 10MB cap —
// created via Storage API, verified with a live upload/fetch/delete round-trip).
// Path shape: `${userId}/${generationId}.${ext}` — public + UUID-unguessable is an
// intentional MVP trade-off for AI-generated marketing images. Revisit with
// private storage + signed URLs before brand-asset uploads (personal photos, M4)
// land, since those are meaningfully more sensitive than generated marketing art.
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "generations";

export async function uploadGeneratedImage(
  db: SupabaseClient,
  userId: string,
  generationId: string,
  bytes: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const path = `${userId}/${generationId}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export function publicImageUrl(db: SupabaseClient, path: string): string {
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const RENDERS_BUCKET = "renders";

/** Upload a rendered video. Path: `${userId}/${projectId}/base.mp4`. Public bucket. */
export async function uploadRender(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  bytes: Buffer,
  kind: "base" | "final" = "base"
): Promise<string> {
  const path = `${userId}/${projectId}/${kind}.mp4`;
  const { error } = await db.storage.from(RENDERS_BUCKET).upload(path, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export function publicRenderUrl(db: SupabaseClient, path: string): string {
  return db.storage.from(RENDERS_BUCKET).getPublicUrl(path).data.publicUrl;
}
