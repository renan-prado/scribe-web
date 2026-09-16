import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { clientEnv } from "@/lib/env/client";
import { SUPABASE_AUTH_COOKIE } from "@/lib/supabase/cookie";

/**
 * Client do Supabase para código de servidor, e o resolvedor de usuário que
 * quase todo mundo aqui precisa.
 *
 * As DUAS funções são memoizadas com `cache()` do React, cujo escopo é UM
 * render pass, layout, page e `generateMetadata` do mesmo request dividem o
 * resultado; requests diferentes nunca. Isso é o oposto de cache persistente:
 * nada aqui sobrevive à resposta.
 *
 * O motivo é que resolver o usuário nunca foi de graça: `getUser()` é um
 * `GET /auth/v1/user` na rede, toda vez. Sem a memoização, um load de /feed
 * fazia OITO dessas idas: uma no proxy, quatro no layout de `(app)`, uma na
 * própria página, e mais duas no `GET /api/coins/balance` que o header
 * disparava logo depois.
 *
 * `cache()` não vale em Route Handlers nem em Server Actions, eles ficam
 * fora da árvore de render do React. Lá o comportamento é o de antes: uma
 * chamada, uma ida à rede. Nada quebra, só não há o que deduplicar.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // O nome do cookie é FIXADO, não derivado da URL. Ver
      // lib/supabase/cookie.ts.
      cookieOptions: { name: SUPABASE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component, session refresh via proxy handles this
          }
        },
      },
    }
  );
});

export type AuthUser = { id: string; email: string | null };

/**
 * O usuário autenticado do request corrente, ou `null`.
 *
 * Prefira esta função a `(await createClient()).auth.getUser()`: é a mesma
 * coisa, mas cobrada uma vez por request em vez de uma vez por chamador.
 *
 * **E ela lê `getClaims()`, não `getUser()`.** A diferença é uma ida à rede:
 * `getUser()` pergunta ao servidor de auth quem é a pessoa, `getClaims()`
 * verifica a assinatura do JWT localmente (WebCrypto contra o JWKS do projeto)
 * e lê a identidade do próprio token. A memoização acima já tinha cortado a
 * QUANTIDADE dessas idas; isto corta a que sobrou.
 *
 * O que sai daqui vira `user.id` em consulta ao banco, e é seguro: quem
 * realmente decide o que aquele id enxerga é o RLS do Postgres, que revalida o
 * mesmo JWT do outro lado. Um token forjado não passa lá. O que claims NÃO
 * garantem é frescor — uma conta desativada no meio da hora continua com token
 * válido até o refresh —, e é por isso que `is_active` é conferido na linha de
 * `profiles` (ver `require-auth.ts` e `lib/db/account.ts`), não aqui.
 *
 * Com chave simétrica (HS256 legado) o `getClaims()` cai de volta no
 * `getUser()` sozinho: nada quebra, só não economiza. Ver `proxy.ts`.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});
