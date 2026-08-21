import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";

/**
 * Service-role Supabase client. BYPASSES RLS — never expose to the browser
 * or return raw responses to unauthenticated requests. Only server code that
 * has already asserted admin authorization (see `requireAdmin`) may use it.
 *
 * Also exposes `.auth.admin.*` for user management (email updates, deletes,
 * listing) that the anon key cannot perform.
 */
export function createAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
