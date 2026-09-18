import { NextResponse } from "next/server";
import { createLexiconReport } from "@/lib/db/lexicon";
import { LexiconReportInputSchema } from "@/lib/domain/lexicon";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Algo está errado" num cartão do léxico.
 *
 * **Não cobra moeda e não chama modelo nenhum**, pela mesma razão de
 * `/api/hallucination-report` e da pesquisa de satisfação: quem está nos
 * ajudando a consertar o produto não paga por isso. Aqui a razão é ainda mais
 * direta — o conteúdo do léxico foi escrito à mão por nós, então não há IA para
 * auditar, e a única resposta possível é uma pessoa ler e corrigir.
 *
 * Por isso também não passa por `requireBalance`: cortar o alerta de quem está
 * com saldo zero silenciaria justamente o aviso que queremos.
 *
 * O `userId` sai da sessão, nunca do corpo. Ver `createLexiconReport`.
 *
 * **Ela convive com `/api/lexicon/[slug]`, e a ordem não é acidente**: o Next
 * resolve o segmento estático antes do dinâmico, então `report` nunca cai no
 * cartão. O preço é que uma entrada com o slug `report` ficaria inalcançável —
 * e como o slug sai de `slugifyTerm` sobre um nome bíblico, isso não acontece.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.lexiconReport, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, LexiconReportInputSchema);
  if (!parsed.ok) return parsed.response;

  const ok = await createLexiconReport({ ...parsed.data, userId: auth.user.id });
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "write_failed" }, { status: 500 });
}
