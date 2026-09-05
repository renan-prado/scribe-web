import "server-only";

/**
 * Escapa os curingas do `like`/`ilike` para que o valor seja comparado como
 * TEXTO.
 *
 * Existe porque `ilike` é a forma de comparar ignorando caixa — e é o único
 * jeito de casar e-mail ou nome digitado por gente — mas `%` e `_` são
 * curingas dentro do padrão. Um valor com `%` deixa de ser "este e-mail" e
 * passa a ser "qualquer e-mail", e quem consome o resultado não tem como saber
 * que a pergunta mudou.
 *
 * O tamanho do estrago depende de quem faz a consulta:
 *
 * - Com o client do usuário, a RLS ainda escopa tudo às linhas dele: um `%`
 *   num nome de local só embaralha os dados de quem digitou.
 * - Com **service-role não há RLS**, e é aí que dói. `findUserIdByEmail`
 *   (exceção de feature por pessoa) e `linkPartnerToUserByEmail` (vínculo do
 *   parceiro com a conta) resolvem um e-mail para um `id` que vira permissão.
 *   Um `%` ali devolve a primeira linha que casar — ou explode em
 *   `maybeSingle`, se casar mais de uma. Nenhum dos dois é o que se pediu.
 *
 * A regra do repositório, escrita em `lib/auth/require-partner.ts` quando o
 * mesmo problema apareceu na resolução do parceiro: **valor de gente nunca
 * entra num `ilike` sem passar por aqui.** A barra invertida vem primeiro na
 * classe de propósito — escapá-la depois de `%` e `_` escaparia a própria
 * escapada.
 */
export function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
