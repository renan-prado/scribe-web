import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth PKCE callback. Google (and any future OAuth provider) redirects
 * here with ?code=... after the user consents. We exchange the code for a
 * session cookie via Supabase, then bounce to `?next=` (or /home).
 *
 * The `?next=` param comes from middleware.ts when it kicks an unauth user
 * off a protected route, so after login the user lands where they were
 * heading originally.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/feed";
  const next = rawNext.startsWith("/") ? rawNext : "/feed";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", error.message);
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (isLocal) return NextResponse.redirect(`${origin}${next}`);
  if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
  return NextResponse.redirect(`${origin}${next}`);
}
