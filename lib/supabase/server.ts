import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { clientEnv } from "@/lib/env/client";

/**
 * Client do Supabase para código de servidor, e o resolvedor de usuário que
 * quase todo mundo aqui precisa.
 *
 * As DUAS funções são memoizadas com `cache()` do React, cujo escopo é UM
 * render pass — layout, page e `generateMetadata` do mesmo request dividem o
 * resultado; requests diferentes nunca. Isso é o oposto de cache persistente:
 * nada aqui sobrevive à resposta.
 *
 * O motivo é que `supabase.auth.getUser()` NÃO é decode local do JWT — é um
 * `GET /auth/v1/user` na rede, toda vez (é justamente por validar no servidor
 * de auth que ele é preferível ao `getSession()`). Sem a memoização, um load
 * de /feed fazia OITO dessas idas: uma no proxy, quatro no layout de `(app)`,
 * uma na própria página, e mais duas no `GET /api/coins/balance` que o header
 * disparava logo depois.
 *
 * `cache()` não vale em Route Handlers nem em Server Actions — eles ficam
 * fora da árvore de render do React. Lá o comportamento é o de antes: uma
 * chamada, uma ida à rede. Nada quebra, só não há o que deduplicar.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
            // Server Component — session refresh via proxy handles this
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
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
});
