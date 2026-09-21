import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBalance } from "@/features/coins/server/require-balance";
import { searchBibleBySense } from "@/features/session/server/biblo/bible-search";
import { chargeCoins } from "@/lib/db/coins";
import { recordChatUsage } from "@/lib/db/usage";
import { BIBLE_SEARCH_MAX_QUESTION_CHARS } from "@/lib/domain/bible-search";
import { requireFeature } from "@/lib/entitlements/server";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("bible-search");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({ question: z.string().trim().min(1).max(BIBLE_SEARCH_MAX_QUESTION_CHARS) })
  .strict();

/**
 * POST /api/bible-search — uma pergunta de sentido, uma lista de passagens.
 *
 * Mesma ordem de sempre: auth → rate limit → o plano permite → há saldo →
 * COBRA → chama o modelo. A funcionalidade usa o MESMO gate de plano do chat
 * (`biblo_chat`) em vez de um catálogo próprio: é o Biblo perguntado de outro
 * jeito, não uma segunda funcionalidade com upsell e matriz de planos
 * dedicados. Ver `lib/entitlements/features.ts`.
 *
 * **Sem `sessionId`.** Ao contrário da conversa dentro de uma sessão, esta
 * busca não pertence a nenhum resumo — o painel da Bíblia é o MESMO
 * componente na leitura, no editor e no gravador, sem saber (nem precisar
 * saber) qual sessão está aberta por trás dele.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["bible-search"], auth.user.id);
  if (limited) return limited;

  const gated = await requireFeature("biblo_chat");
  if (gated) return gated;

  const broke = requireBalance(auth.user);
  if (broke) return broke;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const charge = await chargeCoins("bible_search", null, auth.user.id);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    log.error("charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const result = await searchBibleBySense({ question: parsed.data.question, userId: auth.user.id });
  if (!result.ok) {
    // A moeda já foi debitada e não estorna, mesma régua de `bibloMessage`:
    // duas moedas não pagam a complexidade de um estorno. A tela mostra a
    // frase amigável de sempre.
    log.error("busca falhou", { error: result.error });
    return NextResponse.json(
      { error: "bible_search_failed", balance: charge.balance },
      { status: 502 }
    );
  }

  await recordChatUsage({
    userId: auth.user.id,
    sessionId: null,
    route: "bible-search",
    model: result.model,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    cachedTokens: result.usage.cachedTokens,
    reasoningTokens: result.usage.reasoningTokens,
    latencyMs: result.latencyMs,
  });

  return NextResponse.json({ ...result.data, balance: charge.balance });
}
