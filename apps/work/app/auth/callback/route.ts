// OAuth / magic-link callback: exchanges the ?code for a session, then redirects.
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

// Only ever redirect same-origin — see apps/work/app/login/page.tsx's safeNext
// for the same check on the client side of this same "next" param.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code && isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
