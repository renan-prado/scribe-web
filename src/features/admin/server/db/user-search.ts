import "server-only";
import { escapeLikeValue } from "@/lib/db/like";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A busca de PESSOA dos filtros do painel.
 *
 * Substitui `listUsersForFilter`, que lia `profiles` inteira para encher um
 * `<select>`. O teto daquilo não era declarado em lugar nenhum: o PostgREST
 * cortava no `max-rows` dele e a lista ficava incompleta em silêncio, que é o
 * pior jeito de um filtro falhar — a pessoa procurada não aparece, e quem
 * olha conclui que ela não tem sessão nenhuma. Ver a migração 0074.
 *
 * Aqui quem filtra é o Postgres, e o resultado tem TETO: no máximo
 * `SEARCH_LIMIT` linhas por chamada, digitando ou não. O que viaja para o
 * navegador é sempre essa lista curta, nunca a base.
 *
 * As duas funções cobrem os dois momentos do campo:
 *
 *   - `searchUsersForFilter` responde a cada tecla (via `/api/admin/users/search`);
 *   - `getUserFilterOption` resolve o rótulo de quem JÁ está no `?userId=` da
 *     URL, uma linha por id, para a tela abrir dizendo o nome de quem filtra
 *     em vez de um uuid. O estado mora na URL, como no resto do painel, então
 *     este caminho é o que faz um link colado abrir legível.
 */

export type UserFilterOption = {
  id: string;
  displayName: string | null;
  email: string | null;
};

/** Teto de linhas por busca. Uma lista maior que isto não se lê, se rola. */
export const SEARCH_LIMIT = 20;

/**
 * Piso do termo. Abaixo de dois caracteres a lista não exclui quase nada, e
 * com menos de TRÊS o índice de trigramas não ajuda (um trigrama tem três
 * letras), então a consulta viraria varredura de tabela a cada tecla. O
 * campo, nesse caso, mostra as contas mais recentes, que é a lista de partida.
 */
const MIN_TERM_LENGTH = 2;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT = "id, display_name, email";

type ProfileLite = { id: string; display_name: string | null; email: string | null };

function toOption(row: ProfileLite): UserFilterOption {
  return { id: row.id, displayName: row.display_name, email: row.email };
}

/**
 * Tira do termo os caracteres que quebram a GRAMÁTICA do `or` do PostgREST.
 *
 * O filtro viaja como texto (`or=(display_name.ilike.%joao%,email.ilike.%joao%)`),
 * então uma vírgula ou um parêntese digitados no campo não são dados: são
 * separadores, e o que chega ao Postgres deixa de ser a consulta que se
 * escreveu. `escapeLikeValue` cuida de `%` e `_`, que são curingas do próprio
 * `ilike`; estes aqui são de outra camada e precisam sair antes.
 *
 * Nenhum nome ou e-mail procurável depende deles, então some em vez de virar
 * erro — um filtro que recusa o que foi digitado, num painel, só assusta.
 */
function sanitizeTerm(raw: string): string {
  return escapeLikeValue(raw.replace(/[,()"\\]/g, " ").trim()).slice(0, 80);
}

export async function searchUsersForFilter(rawTerm: string): Promise<UserFilterOption[]> {
  const admin = createAdminClient();
  const term = rawTerm.trim();

  // Um uuid colado é o caminho que vem de outra tela do painel (um link, uma
  // coluna copiada). Procurá-lo por `ilike` no nome nunca acharia nada.
  if (UUID.test(term)) {
    const one = await getUserFilterOption(term);
    return one ? [one] : [];
  }

  if (term.length < MIN_TERM_LENGTH) {
    const { data, error } = await admin
      .from("profiles")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT);
    if (error) throw new Error(`searchUsersForFilter recent failed: ${error.message}`);
    return (data as ProfileLite[]).map(toOption);
  }

  const needle = sanitizeTerm(term);
  if (!needle) return [];

  const { data, error } = await admin
    .from("profiles")
    .select(SELECT)
    .or(`display_name.ilike.%${needle}%,email.ilike.%${needle}%`)
    // Entre vinte linhas que já casaram, a mais nova é a mais provável: o
    // filtro serve para investigar quem chegou, não para folhear o histórico.
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT);
  if (error) throw new Error(`searchUsersForFilter failed: ${error.message}`);
  return (data as ProfileLite[]).map(toOption);
}

export async function getUserFilterOption(id: string): Promise<UserFilterOption | null> {
  if (!UUID.test(id.trim())) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(SELECT)
    .eq("id", id.trim())
    .maybeSingle();
  if (error) throw new Error(`getUserFilterOption failed: ${error.message}`);
  return data ? toOption(data as ProfileLite) : null;
}
