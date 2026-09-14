import { NextResponse } from "next/server";
import { searchSessionIdsByTranscript, searchSessionsByReference } from "@/lib/db/sessions";
import { parseReferenceQuery } from "@/lib/domain/reference-query";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("sessions-search");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/search?q=...
 *
 * A metade da busca das listas que não pode rodar no cliente. São DUAS
 * perguntas sobre a mesma sessão, e nenhuma delas cabe no que a lista carrega:
 *
 * - **O que foi DITO**: `ilike` na transcrição, que não viaja para
 *   `/recordings` nem para `/studies`, e não deve viajar.
 * - **O que foi CITADO**: os versículos. `Jonas 1` não é texto para ser
 *   procurado com `%like%`: o pregador disse "no primeiro capítulo de Jonas",
 *   e o card gravado diz "Jonas 1:1-17". Quem responde é
 *   `lib/domain/reference-query.ts`, comparando referência com referência.
 *
 * A resposta separa as duas porque a lista mostra POR QUE o cartão está ali,
 * "trecho na transcrição" ou a referência que casou. Um cartão que aparece sem
 * explicação, num termo que não bate com nada visível nele, parece defeito.
 *
 * A pergunta de versículo só é feita quando o termo se PARECE com uma
 * referência (`parseReferenceQuery` devolve `null` para "graça"), então a busca
 * comum continua sendo uma consulta só.
 *
 * Não chama modelo nenhum, é `ilike` mais uma RPC de leitura, então não
 * passa por `requireBalance`, pela mesma razão de `/api/verse`. O bucket é
 * próprio e generoso (240/min): a cadência vem de um debounce de 260ms, cujo
 * teto teórico passa dos 120/min de `entity-search`, e um 429 aqui é
 * indistinguível, na tela, de "nada encontrado".
 *
 * O piso de 3 caracteres não é economia: `%a%` casa com todo sermão já
 * gravado, e uma lista que não exclui nada é indistinguível de uma busca
 * quebrada. Abaixo dele a resposta é uma lista vazia com `skipped: true`, para
 * o cliente saber que ninguém procurou, e não que nada foi encontrado.
 */
const MIN_TERM_LENGTH = 3;

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["session-search"], auth.user.id);
  if (limited) return limited;

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200).trim();
  if (q.length < MIN_TERM_LENGTH) {
    return NextResponse.json({ ids: [], verses: [], skipped: true });
  }

  const reference = parseReferenceQuery(q);

  try {
    // As duas perguntas são independentes e caras por motivos diferentes (uma
    // varre texto, a outra expande jsonb): em série o usuário esperaria a soma.
    const [ids, verses] = await Promise.all([
      searchSessionIdsByTranscript(q),
      reference ? searchSessionsByReference(reference) : Promise.resolve([]),
    ]);
    return NextResponse.json({
      ids: [...new Set([...ids, ...verses.map((v) => v.sessionId)])],
      verses: verses.map((v) => ({ id: v.sessionId, reference: v.reference })),
      skipped: false,
    });
  } catch (err) {
    log.error("search failed", { error: (err as Error).message });
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
