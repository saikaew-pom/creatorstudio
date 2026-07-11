// Server-side Supabase access for the work app. Wraps @cs/db's serverClient
// with Next's request-scoped cookie store. Safe to call in route handlers and
// server components; setAll is a no-op in RSC render (cookies are read-only there),
// which @supabase/ssr tolerates as long as middleware refreshes the session.
import { cookies } from "next/headers";
import { serverClient, isSupabaseConfigured } from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export { isSupabaseConfigured };

export function getServerSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return serverClient({
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component render — cookies are read-only here.
        // Middleware handles session refresh, so this is safe to ignore.
      }
    },
  });
}

/** Returns the signed-in user's id, or null if not authenticated / not configured. */
export async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
