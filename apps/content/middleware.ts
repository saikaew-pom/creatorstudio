// Refreshes the Supabase session cookie on every request so server components and
// route handlers see a valid session, and redirects signed-out visitors away from
// the app shell to /login. No-ops when Supabase isn't configured, so the app still
// runs in degraded (no-auth) mode exactly as it did pre-M1.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Pages a signed-out visitor may see: the login/auth flow itself, the public
// inspiration gallery (doc 01 §"/inspiration"), and the marketing pricing page.
const PUBLIC_PATHS = ["/login", "/auth", "/inspiration", "/pricing"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

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
  const { data } = await supabase.auth.getUser();

  // API routes return their own JSON 401s (see app/api/**/route.ts) — a client
  // fetch() call expects to parse JSON, so redirecting to the HTML /login page
  // here would break every signed-out API call (res.json() on an HTML body
  // throws). Let those routes police themselves; only gate page navigations.
  const { pathname, search } = request.nextUrl;
  if (!data.user && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on app pages, skip static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
