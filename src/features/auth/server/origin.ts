import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env/server";

/**
 * De qual endereço esta requisição veio, e podemos confiar nele?
 *
 * O `x-forwarded-host` existe porque atrás do proxy da Vercel o `origin` da
 * requisição é o interno, não o domínio que a pessoa digitou: sem ele, o login
 * em `dev.scriba.cc` devolveria para o host errado, e o link de confirmação de
 * e-mail sairia apontando para uma URL onde o cookie do PKCE não existe.
 *
 * Mas é um HEADER, ou seja, entrada do cliente. Sanitizar o `?next=` e depois
 * montar a URL de destino com um valor que veio do pedido desfaz metade do
 * cuidado. Hoje a Vercel reescreve esse header e só roteia domínios do projeto,
 * então a proteção real é de infraestrutura, não nossa, a mesma situação que a
 * allowlist de origem do `proxy.ts` documenta. A lista abaixo é a decisão
 * voltando para cá; um host não reconhecido cai no `origin` da requisição (nas
 * rotas) ou no `APP_URL` (nas server actions), e nenhum dos dois aponta para
 * fora.
 *
 * Este módulo nasceu no `/auth/callback`, e saiu de lá quando o login por
 * senha precisou da mesma resposta para montar o `emailRedirectTo`.
 */
const TRUSTED_HOSTS = new Set(["scriba.cc", "www.scriba.cc", "dev.scriba.cc"]);
const TRUSTED_HOST_PATTERNS = [/^scribe-[a-z0-9-]+-renanprados-projects\.vercel\.app$/];

export function isTrustedHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.split(":")[0].toLowerCase();
  if (TRUSTED_HOSTS.has(bare)) return true;
  return TRUSTED_HOST_PATTERNS.some((re) => re.test(bare));
}

/**
 * A origem para onde uma rota de `/auth` deve devolver o navegador.
 *
 * Em desenvolvimento o `origin` da requisição já é o certo (`localhost:3000`),
 * e nenhum proxy reescreveu nada, então ele vence antes de qualquer conferência
 * de host.
 */
export function resolveOrigin(request: Request, fallbackOrigin: string): string {
  if (process.env.NODE_ENV === "development") return fallbackOrigin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (isTrustedHost(forwardedHost)) return `https://${forwardedHost?.split(":")[0]}`;
  return fallbackOrigin;
}

/**
 * A origem da requisição corrente, para uma SERVER ACTION.
 *
 * Action não recebe o `Request`, só os headers, e o `host` de um deles é tão
 * do cliente quanto o outro. Quando nenhum dos dois é reconhecido, a resposta
 * é o `APP_URL` do ambiente, e não o palpite: este valor vira o
 * `emailRedirectTo` de um e-mail que sai do nosso remetente, e um host forjado
 * ali seria um link de phishing assinado por nós. (O Supabase ainda recusaria
 * o destino pela allowlist dele, mas isso é a segunda porta, não a primeira.)
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const candidate = h.get("x-forwarded-host") ?? h.get("host");
  if (isTrustedHost(candidate)) return `https://${candidate?.split(":")[0]}`;
  return serverEnv.APP_URL ?? "http://localhost:3000";
}
