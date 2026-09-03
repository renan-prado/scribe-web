import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAdminInsights, readAdminInsights } from "@/lib/admin/insights/generate";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isAdminInsightScope, isInsightStale } from "@/lib/domain/admin-insights";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("api/admin/insights");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O modelo de raciocínio sobre o agregado inteiro mede 40-90s; o teto do
// `callChat` é 180s. A função precisa sobreviver ao pior caso, ou o admin vê
// um 504 depois de a OpenAI já ter cobrado a chamada.
export const maxDuration = 300;

/**
 * Gera a análise de UMA tela do painel.
 *
 * **A conferência de validade é feita DE NOVO aqui**, e não só no card que
 * dispara a requisição. O card decide o que renderizar; a rota decide o que
 * GASTAR — e são duas coisas diferentes no instante em que dois admins abrem o
 * painel ao mesmo tempo, ou em que alguém recarrega a página três vezes. Sem
 * esta reconferência, "uma vez por dia" seria "uma vez por aba".
 *
 * `force` pula a conferência: é o botão de atualizar, um pedido explícito de
 * quem está olhando. O rate limit de admin é o teto dele.
 */

const BodySchema = z.object({
  scope: z.string().refine(isAdminInsightScope, "unknown_scope"),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { scope, force } = parsed.data;

  if (!force) {
    const existing = await readAdminInsights(scope);
    if (existing && !isInsightStale(existing.generatedAt)) {
      return NextResponse.json({ record: existing, reused: true, persistError: null });
    }
  }

  const outcome = await generateAdminInsights(scope, auth.user.id);
  if (!outcome.ok) {
    log.warn("geração falhou", { scope, reason: outcome.reason, detail: outcome.detail });
    // 502 e não 500: o que falhou foi o upstream (ou o formato que ele
    // devolveu), e o card mostra uma mensagem diferente para cada caso.
    //
    // O `detail` vai junto de propósito. É a mensagem do upstream, e esta rota
    // já está atrás de `requireAdmin()` — quem a lê é quem vai consertar. Sem
    // ele, timeout e 401 chegam à tela com o mesmo texto.
    return NextResponse.json({ error: outcome.reason, detail: outcome.detail }, { status: 502 });
  }

  return NextResponse.json({
    record: outcome.record,
    reused: false,
    persistError: outcome.persistError,
  });
}
