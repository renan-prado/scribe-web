import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  encodeRef,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  REF_HINT_COOKIE,
  refCookieOptions,
  refHintCookieOptions,
} from "@/lib/referrals/cookies";
import { normalizeReferralCode } from "@/lib/referrals/economics";

const log = createLogger("referrals/i");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O link de indicação de um usuário comum: `scriba.cc/i/<codigo>`.
 *
 * Irmã de `app/r/[slug]/route.ts`, e deliberadamente igual a ela nas três
 * decisões que parecem cosméticas e não são — 302 em vez de 308 (um
 * permanente seria memorizado pelo navegador e as visitas seguintes nem
 * chegariam ao servidor), redirect também para código inválido (quem clica num
 * link velho não tem nada com isso), e o efeito colateral numa ROTA para a
 * landing page continuar estática (ver "Landing page" em `app/AGENTS.md`).
 *
 * DUAS diferenças em relação à do parceiro, e as duas são de propósito:
 *
 * 1. **Não conta clique.** O parceiro precisa do topo do funil para saber se o
 *    conteúdo dele converte — é o trabalho dele. Quem manda o link no grupo da
 *    igreja não vai otimizar campanha nenhuma, e um rollup de visitas por
 *    usuário seria uma tabela e uma escrita anônima a mais para alimentar um
 *    número que ninguém usaria para decidir nada.
 * 2. **Não confere se o código existe.** Isso custaria uma ida ao banco em
 *    toda visita anônima, e não mudaria o desfecho: o cookie é gravado do
 *    mesmo jeito e a atribuição é conferida no cadastro, que é o único momento
 *    em que ela vale dinheiro. Um código inexistente vira `unknown_code` lá, em
 *    silêncio.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const home = new URL("/", request.nextUrl.origin);
  const code = normalizeReferralCode(raw);

  // Código impossível: nem grava cookie. Só sai da frente.
  if (!code) {
    log.info("código inválido", { raw });
    return NextResponse.redirect(home, 302);
  }

  // O balde é por IP porque não há sessão. Ele não protege o redirect — que
  // acontece de qualquer forma — e sim o cookie: sem limite, um script poderia
  // varrer o espaço de códigos procurando quais existem. Como esta rota não
  // consulta o banco, a varredura não devolveria nada de todo modo; o limite é
  // a segunda tranca da mesma porta.
  const limited = enforceRateLimit(request, RATE_LIMITS["referral-link"]);
  if (limited) {
    log.warn("link de indicação limitado", { code });
    return NextResponse.redirect(home, 302);
  }

  const response = NextResponse.redirect(home, 302);

  // 30 dias, RENOVADOS a cada visita: quem abriu o link e voltou uma semana
  // depois para decidir não deve perder a atribuição por causa do relógio do
  // primeiro clique.
  response.cookies.set(
    REF_COOKIE,
    encodeRef(code, "link", "friend"),
    refCookieOptions(REF_COOKIE_MAX_AGE)
  );
  // A pista do selo do hero. Ver `REF_HINT_COOKIE`.
  response.cookies.set(REF_HINT_COOKIE, "1", refHintCookieOptions(REF_COOKIE_MAX_AGE));

  log.info("clique em link de indicação", { code });
  return response;
}
