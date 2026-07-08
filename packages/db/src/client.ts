// Supabase client factories. Three flavors:
//   browserClient()  — client components ('use client')
//   serverClient()   — server components / route handlers (cookie-scoped session)
//   adminClient()    — service-role, bypasses RLS; server-only, never expose to browser
//
// isSupabaseConfigured() lets the app degrade gracefully when env is unset (so the
// UI still runs pre-M1, exactly like it does today) instead of throwing on import.
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

function requireEnv(): { url: string; anon: string } {
  if (!URL || !ANON)
    throw new Error(
      "Supabase ยังไม่ได้ตั้งค่า — ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env"
    );
  return { url: URL, anon: ANON };
}

export function browserClient(): SupabaseClient {
  const { url, anon } = requireEnv();
  return createBrowserClient(url, anon);
}

/** Cookie adapter matching @supabase/ssr's getAll/setAll contract. Supply the
 * request-scoped cookie store from the Next.js context (route handler, RSC, middleware). */
export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

export function serverClient(cookies: CookieAdapter): SupabaseClient {
  const { url, anon } = requireEnv();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (c: { name: string; value: string; options?: Record<string, unknown> }[]) =>
        cookies.setAll(c),
    },
  });
}

/** Service-role client. Bypasses RLS entirely — use only in trusted server code
 * for privileged operations (RPCs on behalf of a verified user, admin tasks). */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("ต้องมี SUPABASE_SERVICE_ROLE_KEY สำหรับงานฝั่งเซิร์ฟเวอร์");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
