import { type NextRequest, NextResponse } from "next/server";
import { recordPartnerClick } from "@/lib/db/partners";
import { createLogger } from "@/lib/log";
import {
  encodeRef,
  normalizeSlug,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  refCookieOptions,
  VISIT_COOKIE,
  VISIT_COOKIE_MAX_AGE,
} from "@/lib/partners/cookies";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("partners/r");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O link do parceiro: `scriba.cc/r/<slug>`.
 *
 * Marca a visita e manda para a landing page. Três coisas explicam o formato:
 *
 * 1. **Por que uma rota, e não `/?ref=<slug>`.** A landing page é ESTÁTICA, e
 *    isso não é detalhe de performance — é a página que decide se o visitante
 *    fica. Ler cookie dentro de `app/page.tsx` faria o Next marcar a rota como
 *    dinâmica, e a resposta passaria a sair com `no-store`, remontada na origem
 *    a cada visita. Aqui o efeito colateral mora numa rota própria e a LP
 *    continua saindo da CDN. (Ver "Landing page" no AGENTS.md.)
 *
 * 2. **Por que 302, e não 307/308.** É um redirect temporário e sem cache: um
 *    308 seria memorizado pelo navegador e as próximas visitas ao link nem
 *    chegariam ao servidor — o parceiro perderia a contagem a partir do
 *    segundo clique da mesma pessoa.
 *
 * 3. **Por que slug inválido também redireciona.** Quem clica num link velho
 *    ou digitado errado não tem nada com isso: cai na landing page como
 *    qualquer visitante. Um 404 aqui transformaria um erro nosso (ou do
 *    parceiro) em porta fechada na cara de alguém que veio conhecer o produto.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await ctx.params;
  const home = new URL("/", request.nextUrl.origin);
  const slug = normalizeSlug(raw);

  // Slug impossível: nem consulta o banco. Só sai da frente.
  if (!slug) {
    log.info("slug inválido", { raw });
    return NextResponse.redirect(home, 302);
  }

  const response = NextResponse.redirect(home, 302);

  // A indicação sobrevive 30 dias e é RENOVADA a cada visita: quem acompanha
  // o parceiro e clica de novo antes de decidir não deve perder a atribuição
  // por causa do relógio do primeiro clique.
  response.cookies.set(REF_COOKIE, encodeRef(slug, "link"), refCookieOptions(REF_COOKIE_MAX_AGE));

  // Contagem de cliques. O redirect JÁ está montado: daqui para baixo é tudo
  // métrica, e nada pode impedir a pessoa de chegar na landing page.
  const limited = enforceRateLimit(request, RATE_LIMITS["partner-link"]);
  if (limited) {
    log.warn("clique não contado — rate limit", { slug });
    return response;
  }

  // `unique` = primeira visita deste navegador a ESTE parceiro nas últimas
  // 24h. Guardamos o slug (e não um booleano) para que abrir o link de dois
  // parceiros no mesmo dia conte um único para cada um.
  const lastVisit = request.cookies.get(VISIT_COOKIE)?.value;
  const unique = lastVisit !== slug;
  response.cookies.set(VISIT_COOKIE, slug, refCookieOptions(VISIT_COOKIE_MAX_AGE));

  await recordPartnerClick(slug, unique);
  log.info("clique", { slug, unique });

  return response;
}
