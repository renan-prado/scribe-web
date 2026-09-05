import "server-only";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/log";
import { createClient } from "./server";

const log = createLogger("require-auth");

/**
 * Gate de sessão para rota de API: 401 quando não há sessão, 403 quando a
 * conta foi desativada.
 *
 * A conferência de `is_active` mora AQUI porque este é o funil por onde toda
 * rota passa. Ela já existia como coluna desde a migração 0007, cujo cabeçalho
 * afirmava que "the app checks it in the proxy on the next request" — e o
 * proxy nunca conferiu. O efeito era um botão de banimento no /admin que
 * pintava a linha de vermelho e não tirava nada de ninguém: a pessoa
 * desativada seguia gravando, transcrevendo e gastando nossa cota de OpenAI.
 *
 * Não vai para o `proxy.ts` de propósito: lá custaria uma consulta ao banco em
 * TODA requisição do site, inclusive nas estáticas que o matcher deixa passar.
 * Aqui custa uma por chamada de API — e as páginas são cobertas pelos layouts,
 * que leem o mesmo campo da consulta já memoizada de `lib/db/account.ts`.
 *
 * **Só `is_active = false` explícito recusa.** Linha ausente ou erro de leitura
 * seguem em frente, pelo mesmo princípio de `getCurrentBalance`: uma
 * inconsistência do nosso lado não pode trancar quem não fez nada. Banimento é
 * um fato gravado, não a ausência de um.
 *
 * A mesma consulta traz `coin_balance`, e por isso `user` o devolve: as rotas
 * de LLM precisam de um piso de saldo (ver `lib/coins/require-balance.ts`) e
 * lê-lo aqui é de graça — a linha de `profiles` já está sendo aberta. `null`
 * quer dizer "não sei", não "zero", e quem consome trata as duas de formas
 * diferentes.
 */

type AuthUser = { id: string; coinBalance: number | null };
type AuthResult = { user: AuthUser; response: null } | { user: null; response: NextResponse };

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

  // Consulta própria, como em `requireAdmin`: `cache()` não vale em Route
  // Handler, e este é o caminho que protege dinheiro — não divide estado com
  // nada.
  const { data, error } = await supabase
    .from("profiles")
    .select("is_active, coin_balance")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    log.warn("não consegui ler o perfil — seguindo", { userId: user.id, error: error.message });
  } else if (data?.is_active === false) {
    return {
      user: null,
      response: NextResponse.json({ error: "account_disabled" }, { status: 403 }),
    };
  }

  return { user: { id: user.id, coinBalance: data?.coin_balance ?? null }, response: null };
}
