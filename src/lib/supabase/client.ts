import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";
import { SUPABASE_AUTH_COOKIE } from "@/lib/supabase/cookie";

export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // O nome do cookie é FIXADO, não derivado da URL. Ver lib/supabase/cookie.ts:
    // sem isto, trocar a URL do Supabase por um domínio customizado renomeia o
    // cookie e desloga todo mundo.
    { cookieOptions: { name: SUPABASE_AUTH_COOKIE } }
  );
}
