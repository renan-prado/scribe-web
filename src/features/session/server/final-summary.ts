import "server-only";
import {
  FINAL_SUMMARY_NO_VERSE_TEXT_RETRY,
  FINAL_SUMMARY_SYSTEM_PROMPT,
} from "@/features/session/server/prompts/final-summary";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import { parseSummaryFromLLM, type SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";

/**
 * Shared LLM chain that produces a final SummaryPayload from a transcript +
 * curated feed items. Used by:
 *   - POST /api/final-summary          (first pass, right after stop)
 *   - POST /api/final-summary/reprocess (re-run on a saved session)
 *   - a importação do YouTube (`lib/youtube/*`)
 *
 * **É UMA chamada só.** Havia uma segunda, o "enriquecimento", que recebia os
 * blocks já organizados e devolvia inserções de `contextCard` e `relatedVerse`,
 * os comentários do Scriba que a tela desenhava num balão. Ela saiu inteira:
 * prompt, tipos de bloco, rotas de telemetria (`summary-enrichment*`) e o
 * componente. Era a segunda chamada mais cara do produto (entrada com o sermão
 * inteiro de novo) para uma camada que o usuário não usava. Se um dia voltar,
 * volta como decisão de produto, não como "faltou algo aqui".
 */

export type GenerateFinalSummarySuccess = {
  ok: true;
  payload: SummaryPayload;
  latencyMs: number;
  model: string;
};

export type GenerateFinalSummaryError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  /**
   * O modelo respondeu 200 e o que veio não tem UM bloco. JSON truncado pelo
   * filtro de conteúdo do provedor, refusal, ou um objeto de outra forma.
   *
   * **Isto já foi um `ok: true`**, e era o pior desfecho do produto: o payload
   * vazio ia para o banco por cima da sessão, a rota devolvia 200, e quem
   * pagou ficava com uma tela em esqueleto para sempre. Uma sessão vale mais
   * sem resumo (com a transcrição salva e o "Gerar novamente" à mão) do que
   * com um resumo de zero blocos gravado como se tivesse dado certo.
   */
  | { ok: false; kind: "empty"; message: string; latencyMs: number };

export type GenerateFinalSummaryResult = GenerateFinalSummarySuccess | GenerateFinalSummaryError;

export type GenerateFinalSummaryInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  /**
   * O que quem gravou digitou DURANTE a pregação (ver `recording-notes.ts`).
   * Vai para o prompt marcado como notas do ouvinte, e não como transcrição:
   * elas corrigem nome próprio e referência que o microfone não entregou, e
   * dizem o que importou para quem estava lá. Ausente em toda rota que não
   * nasce de uma gravação.
   */
  notes?: string | null;
  /** Log tag, "final-summary" or "final-summary-reprocess". */
  logPrefix: string;
  /** Metadata route tag on the OpenAI store record + usage rows. */
  metadataRoute: Extract<
    UsageRoute,
    | "final-summary"
    | "final-summary-reprocess"
    | "final-summary-from-transcript"
    | "final-summary-youtube"
  >;
};

/**
 * Uma tentativa: a chamada, o parse, o log e o registro de uso. Sempre grava
 * `llm_usage_events`, inclusive quando o payload volta vazio, porque o
 * provedor cobra a chamada cortada igual, e um custo que não aparece no
 * `/admin/usage` é um custo que ninguém acha depois.
 */
async function attemptFinalSummary(params: {
  input: GenerateFinalSummaryInput;
  log: ReturnType<typeof createLogger>;
  model: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<
  | { ok: true; payload: SummaryPayload; finishReason: string; latencyMs: number }
  | GenerateFinalSummaryError
> {
  const { input, log, model, systemPrompt, userMessage } = params;
  const { userId, sessionId, metadataRoute } = input;

  const result = await callChat({
    model,
    temperature: 0.2,
    maxTokens: 12000,
    // O padrão de `callChat` é 60s, e esta é a maior chamada do produto: o
    // sermão inteiro na entrada e um sermão organizado inteiro na saída.
    // Abortar aqui devolve 502 DEPOIS de o usuário ter gravado e pago, o
    // mesmo raciocínio que fez as etapas [2] e [4] do estudo declararem o
    // seu. Com os alvos de densidade que o prompt pede hoje, 60s é aposta.
    timeoutMs: 180_000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: metadataRoute, userId, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      log.error(`upstream fetch failed`, { error: result.error.message });
      return { ok: false, kind: "fetch", message: result.error.message };
    }
    log.error(`upstream error`, {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return {
      ok: false,
      kind: "upstream",
      message: result.error.message,
      status: result.error.status,
      latencyMs: result.error.latencyMs,
    };
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const payload = parseSummaryFromLLM(content, "final");

  log.debug(`ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
  });
  if (finishReason === "length") {
    log.warn(`output truncated by max_tokens`, {
      completionTokens: usage.completionTokens,
    });
  }
  await recordChatUsage({
    userId,
    sessionId,
    route: metadataRoute,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });

  return { ok: true, payload, finishReason, latencyMs };
}

/**
 * ## A SEGUNDA tentativa, e por que ela existe
 *
 * Um payload de ZERO blocos nunca serve para nada: ele é gravado por cima da
 * sessão, a pessoa já pagou, e a tela não tem o que desenhar. Então vale mais
 * uma segunda chamada do que devolver aquilo, e é o que acontece aqui, uma
 * vez só.
 *
 * O que a segunda tentativa MUDA depende do motivo da primeira ter voltado
 * vazia, e há um motivo que uma repetição igual nunca resolveria:
 *
 *   - `finish_reason: "content_filter"` → o filtro do provedor cortou a
 *     resposta no meio, e isso é DETERMINÍSTICO: a mesma transcrição morre no
 *     mesmo token quantas vezes se tente. A segunda vai com
 *     `FINAL_SUMMARY_NO_VERSE_TEXT_RETRY`, que tira do caminho o único trecho
 *     que o filtro leu errado nos casos vistos, o texto do versículo. Ver o
 *     cabeçalho daquela constante para o caso que revelou isso.
 *   - qualquer outro motivo (JSON de outra forma, objeto sem `blocks`) → a
 *     segunda é a MESMA chamada, porque ali a variação de amostragem é o que
 *     pode salvar, e estreitar o prompt só pioraria o resumo.
 *
 * Se a segunda também vier vazia, a rota recebe `kind: "empty"` e NÃO grava
 * nada. É o que dá à pessoa a transcrição intacta e um "Gerar novamente" que
 * pode dar certo, em vez de um resumo de zero blocos carimbado como sucesso.
 */
export async function generateFinalSummary(
  input: GenerateFinalSummaryInput
): Promise<GenerateFinalSummaryResult> {
  const { transcript, notes, logPrefix } = input;
  const log = createLogger(logPrefix);
  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  const trimmedNotes = notes?.trim();
  const userMessage = trimmedNotes
    ? `transcript:
${transcript}

notas do ouvinte:
${trimmedNotes}`
    : `transcript:
${transcript}`;

  const first = await attemptFinalSummary({
    input,
    log,
    model,
    systemPrompt: FINAL_SUMMARY_SYSTEM_PROMPT,
    userMessage,
  });
  if (!first.ok) return first;
  if (first.payload.blocks.length > 0) {
    return { ok: true, payload: first.payload, latencyMs: first.latencyMs, model };
  }

  const filtered = first.finishReason === "content_filter";
  log.warn(`resumo vazio, tentando de novo`, {
    finishReason: first.finishReason,
    // `true` = a segunda vai pedir `bibleQuote` sem texto. É por este campo
    // que se mede se o filtro do provedor está cortando resumo em produção.
    withoutVerseText: filtered,
  });

  const second = await attemptFinalSummary({
    input,
    log,
    model,
    systemPrompt: filtered
      ? FINAL_SUMMARY_SYSTEM_PROMPT + FINAL_SUMMARY_NO_VERSE_TEXT_RETRY
      : FINAL_SUMMARY_SYSTEM_PROMPT,
    userMessage,
  });
  if (!second.ok) return second;

  const latencyMs = first.latencyMs + second.latencyMs;
  if (second.payload.blocks.length > 0) {
    log.info(`resumo salvo na segunda tentativa`, { withoutVerseText: filtered, latencyMs });
    return { ok: true, payload: second.payload, latencyMs, model };
  }

  log.error(`resumo vazio nas duas tentativas`, {
    finishReason: second.finishReason,
    withoutVerseText: filtered,
  });
  return {
    ok: false,
    kind: "empty",
    message: `resumo vazio nas duas tentativas (finish_reason=${first.finishReason}/${second.finishReason})`,
    latencyMs,
  };
}
