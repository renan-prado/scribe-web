import "server-only";
import { NextResponse } from "next/server";
import { firstNameFrom } from "@/lib/domain/profile";
import { createLogger } from "@/lib/log";
import { createClient } from "./server";

const log = createLogger("require-auth");

/**
 * Gate de sessão para rota de API: 401 quando não há sessão, 403 quando a
 * conta foi desativada.
 *
 * A conferência de `is_active` mora AQUI porque este é o funil por onde toda
 * rota passa. Ela já existia como coluna desde a migração 0007, cujo cabeçalho
 * afirmava que "the app checks it in the proxy on the next request", e o
 * proxy nunca conferiu. O efeito era um botão de banimento no /admin que
 * pintava a linha de vermelho e não tirava nada de ninguém: a pessoa
 * desativada seguia gravando, transcrevendo e gastando nossa cota de OpenAI.
 *
 * Não vai para o `proxy.ts` de propósito: lá custaria uma consulta ao banco em
 * TODA requisição do site, inclusive nas estáticas que o matcher deixa passar.
 * Aqui custa uma por chamada de API, e as páginas são cobertas pelos layouts,
 * que leem o mesmo campo da consulta já memoizada de `lib/db/account.ts`.
 *
 * **Só `is_active = false` explícito recusa.** Linha ausente ou erro de leitura
 * seguem em frente, pelo mesmo princípio de `getCurrentBalance`: uma
 * inconsistência do nosso lado não pode trancar quem não fez nada. Banimento é
 * um fato gravado, não a ausência de um.
 *
 * A mesma consulta traz `coin_balance`, e por isso `user` o devolve: as rotas
 * de LLM precisam de um piso de saldo (ver `lib/coins/require-balance.ts`) e
 * lê-lo aqui é de graça, a linha de `profiles` já está sendo aberta. `null`
 * quer dizer "não sei", não "zero", e quem consome trata as duas de formas
 * diferentes.
 *
 * `isInternal` entra pela mesma régua: é a conta de Backoffice (migração
 * 0073), e quem precisa dela é o piso de saldo — uma conta interna não tem
 * saldo que signifique alguma coisa, então recusá-la por "saldo zero" seria
 * trancar justamente a conta que existe para testar. Ver
 * `features/coins/server/require-balance.ts`.
 *
 * `firstName` entra pela MESMA razão e com a mesma régua: é uma coluna a mais
 * numa linha já aberta, para as rotas em que o produto fala COM a pessoa em
 * vez de sobre ela (hoje só a abertura do Biblo). `null` quer dizer "não há
 * nome usável", e quem cumprimenta simplesmente omite o nome.
 *
 * **A identidade vem de `getClaims()`, não de `getUser()`.** Era uma ida à
 * rede por chamada de API, e `cache()` não vale em Route Handler, então nem a
 * memoização a segurava: duas chamadas de API eram duas viagens ao servidor de
 * auth. `getClaims()` verifica o JWT localmente. O frescor que se perde é
 * justamente o que a consulta logo abaixo repõe — `is_active` sai da linha de
 * `profiles`, que é o fato gravado, e não do token. Ver `lib/supabase/server.ts`.
 */

type AuthUser = {
  id: string;
  coinBalance: number | null;
  /** Conta de Backoffice: gasta sem debitar saldo (migração 0073). */
  isInternal: boolean;
  firstName: string | null;
};
type AuthResult = { user: AuthUser; response: null } | { user: null; response: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return {
      user: null,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }

  // Consulta própria, como em `requireAdmin`: `cache()` não vale em Route
  // Handler, e este é o caminho que protege dinheiro, não divide estado com
  // nada.
  const { data, error } = await supabase
    .from("profiles")
    .select("is_active, coin_balance, is_internal, display_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    log.warn("não consegui ler o perfil, seguindo", { userId, error: error.message });
  } else if (data?.is_active === false) {
    return {
      user: null,
      response: NextResponse.json({ error: "account_disabled" }, { status: 403 }),
    };
  }

  return {
    user: {
      id: userId,
      coinBalance: data?.coin_balance ?? null,
      // `=== true` e não `?? false`: erro de leitura devolve conta NORMAL, e a
      // conta normal é a que paga. O engano seguro aqui é cobrar de quem não
      // devia, nunca liberar quem não é.
      isInternal: data?.is_internal === true,
      firstName: firstNameFrom(data?.display_name ?? null, data?.email ?? null),
    },
    response: null,
  };
}
