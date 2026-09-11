import { type NextRequest, NextResponse } from "next/server";
import { normalizeCouponCode } from "@/lib/domain/coupon";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { COUPON_COOKIE, COUPON_COOKIE_MAX_AGE, refCookieOptions } from "@/lib/referrals/cookies";

const log = createLogger("coupons/c");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O link de um cupom de cadastro: `scriba.cc/c/<codigo>`.
 *
 * Irmã de `app/i/[code]/route.ts` e de `app/r/[slug]/route.ts`, e igual a elas
 * nas decisões que parecem cosméticas e não são: 302 e não 308 (um permanente
 * seria memorizado pelo navegador e as visitas seguintes nem chegariam ao
 * servidor), redirect também para código impossível (quem clica num link velho
 * não tem nada com isso), e o efeito colateral numa ROTA, e não numa página,
 * para nenhuma delas custar a estaticidade da landing.
 *
 * DUAS diferenças, e as duas são de propósito:
 *
 * 1. **Vai para `/sign-in`, não para a landing.** O link de parceiro e o de
 *    amigo são divulgação: quem os abre ainda não decidiu nada, e a LP é a peça
 *    que convence. Um cupom é um convite nominal, mandado a quem já foi
 *    convidado por uma pessoa, e a frase que o acompanha é "crie sua conta por
 *    aqui". Passar pela página de vendas seria pôr um argumento no caminho de
 *    quem já disse sim. A tela de entrada mostra quantas moedas o cupom vale.
 * 2. **Não confere se o cupom existe.** Custaria uma ida ao banco em toda
 *    visita anônima e não mudaria o desfecho: o cookie é gravado do mesmo jeito
 *    e a validade é conferida DUAS vezes depois, na tela de entrada (que
 *    simplesmente não anuncia bônus nenhum) e dentro de `redeem_signup_coupon`,
 *    que é o único momento em que ela vale dinheiro.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const signIn = new URL("/sign-in", request.nextUrl.origin);
  const code = normalizeCouponCode(raw);

  // Código impossível: nem grava cookie. Só sai da frente.
  if (!code) {
    log.info("código inválido", { raw });
    return NextResponse.redirect(signIn, 302);
  }

  // O balde é por IP porque não há sessão. Ele não protege o redirect, que
  // acontece de qualquer forma, e sim o cookie: sem limite, um script varreria o
  // espaço de códigos procurando um cupom vivo. Como esta rota não consulta o
  // banco, a varredura não devolveria nada de todo modo, e quem responderia
  // "existe" é a tela de entrada, uma tela por vez.
  const limited = enforceRateLimit(request, RATE_LIMITS["coupon-link"]);
  if (limited) {
    log.warn("link de cupom limitado", { code });
    return NextResponse.redirect(signIn, 302);
  }

  const response = NextResponse.redirect(signIn, 302);

  // 30 dias, RENOVADOS a cada visita, como o cookie de indicação: quem abriu o
  // convite e voltou uma semana depois para criar a conta não deve perder o
  // bônus por causa do relógio do primeiro clique.
  response.cookies.set(COUPON_COOKIE, code, refCookieOptions(COUPON_COOKIE_MAX_AGE));

  log.info("clique em cupom", { code });
  return response;
}
