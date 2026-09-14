import { NextResponse } from "next/server";
import { generateAdminInsights } from "@/lib/admin/insights/generate";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("api/admin/insights");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O modelo de raciocínio sobre o agregado inteiro mede 40-90s; o teto do
// `callChat` é 240s. A função precisa sobreviver ao pior caso, ou o admin vê
// um 504 depois de a OpenAI já ter cobrado a chamada.
export const maxDuration = 300;

/**
 * Gera A leitura da IA sobre os números do painel. Uma só, geral.
 *
 * **Ela roda exatamente quando alguém clica**, e isso é a mudança que este
 * arquivo carrega. Antes havia três leituras, uma por tela de dinheiro, e o
 * card de cada tela DISPARAVA a geração sozinho quando a linha gravada passava
 * de 24 horas. A rota reconferia a validade para que "uma vez por dia" não
 * virasse "uma vez por aba", e nada disso era pedido por ninguém: quem abria
 * `/admin/metricas` para conferir o MRR pagava um modelo de raciocínio.
 *
 * Sem disparo automático, a conferência de validade some junto: não há o que
 * proteger contra recarregar a página, porque recarregar não gera nada. O que
 * limita o clique repetido é o `RATE_LIMITS.admin`, e o que a tela mostra
 * enquanto isso é a data da leitura anterior, para a decisão de gerar de novo
 * ser de quem está olhando.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const outcome = await generateAdminInsights(auth.user.id);
  if (!outcome.ok) {
    log.warn("geração falhou", { reason: outcome.reason, detail: outcome.detail });
    // 502 e não 500: o que falhou foi o upstream (ou o formato que ele
    // devolveu), e a tela mostra uma mensagem diferente para cada caso.
    //
    // O `detail` vai junto de propósito. É a mensagem do upstream, e esta rota
    // já está atrás de `requireAdmin()`, quem a lê é quem vai consertar. Sem
    // ele, timeout e 401 chegam à tela com o mesmo texto.
    return NextResponse.json({ error: outcome.reason, detail: outcome.detail }, { status: 502 });
  }

  return NextResponse.json({
    record: outcome.record,
    persistError: outcome.persistError,
  });
}
