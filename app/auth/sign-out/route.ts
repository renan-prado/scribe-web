import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/sign-out — clears the Supabase session cookie and redirects
 * back to the landing page. Called from the avatar dropdown + profile page
 * via a `<form action="/auth/sign-out" method="post">`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
