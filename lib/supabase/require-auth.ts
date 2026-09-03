import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "./server";

type AuthResult = { user: { id: string }; response: null } | { user: null; response: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  return { user, response: null };
}
