import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { attachPartner } from "@/lib/db/partners";
import { createLogger } from "@/lib/log";
import { decodeRef, REF_COOKIE, VISIT_COOKIE } from "@/lib/partners/cookies";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("auth/callback");

/**
 * OAuth PKCE callback. Google (and any future OAuth provider) redirects
 * here with ?code=... after the user consents. We exchange the code for a
 * session cookie via Supabase, then bounce to `?next=` (or /feed).
 *
 * The `?next=` param comes from middleware.ts when it kicks an unauth user
 * off a protected route, so after login the user lands where they were
 * heading originally.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Mesma sanitização do proxy: só caminho relativo, recusando as formas que
  // o navegador resolve como host externo ("//evil.com", "/\evil.com",
  // "/%2Fevil.com"). Um `next` frouxo aqui é um open redirect assinado pelo
  // nosso domínio, logo depois do login — o vetor clássico de phishing.
  const rawNext = searchParams.get("next") ?? "/feed";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\") &&
    !/^\/%(2f|5c)/i.test(rawNext)
      ? rawNext
      : "/feed";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    log.error("exchangeCodeForSession failed", { error: error.message });
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  await attachPartnerIfReferred(data.user?.id ?? null);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (isLocal) return NextResponse.redirect(`${origin}${next}`);
  if (forwardedHost && isTrustedHost(forwardedHost)) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * O `x-forwarded-host` existe aqui porque atrás do proxy da Vercel o `origin`
 * da requisição é o interno, não o domínio que a pessoa digitou — sem ele o
 * login em `dev.scriba.cc` devolveria para o host errado.
 *
 * Mas é um HEADER: sanitizar o `?next=` logo acima e depois montar a URL de
 * destino com um valor que vem do pedido desfaz metade do cuidado. Hoje a
 * Vercel reescreve esse header e só roteia domínios do projeto, então a
 * proteção real é de infraestrutura, não nossa — a mesma situação que a
 * allowlist de origem do `proxy.ts` documenta. A lista abaixo é a decisão
 * voltando para cá; um host não reconhecido cai no `origin`, que é o
 * comportamento correto e nunca aponta para fora.
 */
const TRUSTED_HOSTS = new Set(["scriba.cc", "www.scriba.cc", "dev.scriba.cc"]);
const TRUSTED_HOST_PATTERNS = [/^scribe-[a-z0-9-]+-renanprados-projects\.vercel\.app$/];

function isTrustedHost(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (TRUSTED_HOSTS.has(bare)) return true;
  return TRUSTED_HOST_PATTERNS.some((re) => re.test(bare));
}

/**
 * Vincula a conta ao parceiro que a indicou, se houver indicação ativa, e
 * credita o bônus. Roda no primeiro login de quem chegou por `/r/<slug>` ou
 * digitou um código na tela de entrada.
 *
 * É aqui, e não no trigger de criação do perfil, porque o cookie só existe no
 * contexto da requisição — o trigger do banco roda dentro do Supabase Auth e
 * não enxerga o navegador.
 *
 * NADA aqui pode impedir o login. Toda recusa (`already_attributed`,
 * `not_new`, `unknown_slug`, `self_referral`) é normal e vira log; uma
 * exceção inesperada é engolida pelo try/catch. A pessoa está no meio da
 * entrada no app, e perder um bônus é ruim — não entrar é pior.
 *
 * O cookie é apagado nos dois desfechos. Ele já cumpriu o papel: a atribuição
 * agora vive em `profiles.partner_id`, que é permanente. Deixá-lo por mais 30
 * dias faria toda visita seguinte a `/auth/callback` (um novo login em outro
 * aparelho, por exemplo) tentar de novo uma atribuição já resolvida.
 */
async function attachPartnerIfReferred(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const jar = await cookies();
    const ref = decodeRef(jar.get(REF_COOKIE)?.value);
    if (!ref) return;

    const result = await attachPartner({ userId, slug: ref.slug, source: ref.source });
    log.info("atribuição de parceiro", { ...ref, result });

    jar.delete(REF_COOKIE);
    jar.delete(VISIT_COOKIE);
  } catch (err) {
    log.error("partner attach falhou", { error: (err as Error).message });
  }
}
