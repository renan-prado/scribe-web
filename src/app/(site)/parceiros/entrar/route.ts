import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  PROSPECT_COOKIE,
  PROSPECT_COOKIE_MAX_AGE,
  refCookieOptions,
} from "@/lib/referrals/cookies";

const log = createLogger("partners/prospect");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O caminho de entrada do PRÉ-PARCEIRO: `/parceiros/entrar` → cookie →
 * `/sign-in`.
 *
 * **Existe uma rota no meio pela mesma razão que `/r/<slug>`:** `/parceiros` é
 * ESTÁTICA e não pode escrever cookie sem deixar de ser, o que custaria a ela
 * o mesmo que custaria à landing page (HTML remontado na origem a cada visita,
 * `no-store`, bfcache derrubado). O efeito colateral mora aqui, e as duas
 * páginas continuam saindo da CDN.
 *
 * O cookie diz apenas "esta visita veio da página de parceiros". Ele não credita
 * nada e não decide nada sozinho: quem credita é `attach_partner_prospect`, no
 * `/auth/callback`, depois de conferir que a conta é nova e que a pessoa não
 * ganhou outro bônus de boas-vindas. Ver a migração 0050.
 *
 * 302, não 308, pelo motivo de sempre: um permanente seria memorizado pelo
 * navegador e as próximas visitas nem chegariam ao servidor, o cookie deixaria
 * de ser renovado para quem voltou uma semana depois para decidir.
 */
export async function GET(request: NextRequest) {
  const signIn = new URL("/sign-in", request.nextUrl.origin);
  const response = NextResponse.redirect(signIn, 302);

  // O rate limit aqui não protege o crédito, quem protege é a RPC, que exige
  // conta nova, recusa repetição por PRIMARY KEY e respeita o teto global. Ele
  // corta a rajada boba: um script batendo nesta rota só gastaria banda nossa.
  const limited = enforceRateLimit(request, RATE_LIMITS["partner-link"]);
  if (limited) {
    log.warn("entrada de pré-parceiro limitada");
    return response;
  }

  response.cookies.set(PROSPECT_COOKIE, "1", refCookieOptions(PROSPECT_COOKIE_MAX_AGE));
  log.info("visitante marcado como pré-parceiro");
  return response;
}
