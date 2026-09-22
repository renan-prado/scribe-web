/**
 * Sanitiza um `?next=` antes de qualquer redirecionamento pós-login.
 *
 * Exige caminho relativo à nossa origem e recusa as formas que os navegadores
 * resolvem como host externo, `//evil.com`, `/\evil.com`, `/%2F...`. Sem isso,
 * um link `/sign-in?next=...` publicado por terceiros viraria um open redirect
 * com a credibilidade do nosso domínio, logo depois do login, que é o vetor
 * clássico de phishing sobre fluxo de entrada.
 *
 * **Esta função é o único lugar onde essa regra mora.** Ela já existiu em três:
 * no `proxy.ts`, no `/auth/callback` e, quando o login por senha chegou, teria
 * nascido uma quarta nas server actions. Três cópias de uma regra de segurança
 * é uma promessa de que um dia uma delas vai receber um caso novo e as outras
 * não.
 *
 * Client-safe de propósito: o `proxy.ts` roda fora da árvore de render, as
 * rotas de `/auth` rodam no servidor e os formulários de entrada precisam do
 * mesmo destino ao montar a URL de callback do e-mail.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  // "//host" e "/\host" são resolvidos como URL absoluta pelos navegadores.
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\")) return null;
  // "/%2F..." e "/%5C..." viram as formas acima depois da decodificação.
  if (/^\/%2f/i.test(raw)) return null;
  if (/^\/%5c/i.test(raw)) return null;
  return raw;
}

/** O destino padrão de quem entra: a Biblioteca. */
export const DEFAULT_NEXT = "/home";

/** `safeNextPath` com o destino padrão já aplicado. */
export function nextPathOrDefault(raw: string | null | undefined): string {
  return safeNextPath(raw) ?? DEFAULT_NEXT;
}
