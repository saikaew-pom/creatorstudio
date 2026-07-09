// Refreshes the Supabase session cookie on every request so server components and
// route handlers see a valid session. No-ops when Supabase isn't configured, so the
// app still runs in degraded (no-auth) mode exactly as it did pre-M1.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
      ) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options as never);
      },
    },
  });

  // Touch the session so the refresh token rotates before it expires.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Run on app pages, skip static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
