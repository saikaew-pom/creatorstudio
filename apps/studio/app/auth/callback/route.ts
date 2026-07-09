// OAuth / magic-link callback: exchanges the ?code for a session, then redirects.
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code && isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
