/**
 * O consentimento de cookies: nome, prazo e a leitura/escrita no navegador.
 *
 * Client-safe e sem dependência. Quem lê é o `CookieConsent` (o bloqueio) e o
 * `AnalyticsAfterConsent` (o GA4 só nasce depois do aceite).
 *
 * **O Scriba não funciona sem cookies, e o aviso não finge que funciona.** A
 * sessão de login é um cookie; sem ela não há conta, biblioteca nem gravação.
 * Um banner de "recusar e continuar" seria uma promessa que o produto não
 * cumpre. Por isso a escolha é binária: aceita e usa, ou não usa. Quem recusa
 * vê o motivo e pode rever a decisão, e as páginas legais continuam legíveis
 * (`CONSENT_EXEMPT_PATHS`), senão a pessoa teria de aceitar a política antes
 * de poder lê-la.
 *
 * **É um cookie, e não localStorage**, porque é a mesma família do que se está
 * consentindo e porque o servidor pode lê-lo no dia em que precisar. Ele NÃO é
 * `httpOnly`: quem escreve é o navegador, no clique.
 *
 * **O valor é uma VERSÃO.** Se a política de cookies mudar de um jeito que peça
 * um novo aceite (um cookie de publicidade, por exemplo), sobe-se
 * `CONSENT_VERSION` e todo mundo volta a ver o aviso, sem migração nenhuma.
 */

export const CONSENT_COOKIE = "scriba_cookie_consent";

export const CONSENT_VERSION = "1";

/** Um ano: o teto que se pratica para um aceite antes de perguntar de novo. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Evento de janela disparado no aceite, para quem já está montado reagir. */
export const CONSENT_EVENT = "scriba:cookie-consent";

/**
 * Onde o aviso NÃO bloqueia: os textos que explicam o que se está aceitando.
 * Casamento por prefixo exato de segmento.
 */
export const CONSENT_EXEMPT_PATHS = ["/privacy", "/terms", "/partners/terms"] as const;

export function isConsentExemptPath(pathname: string): boolean {
  return CONSENT_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.cookie
      .split(";")
      .some((part) => part.trim() === `${CONSENT_COOKIE}=${CONSENT_VERSION}`);
  } catch {
    return false;
  }
}

export function grantConsent(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API ainda não existe no Safari
  document.cookie = `${CONSENT_COOKIE}=${CONSENT_VERSION}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
