import "server-only";
import {
  FINAL_SUMMARY_CHUNK_SUFFIX,
  FINAL_SUMMARY_NO_VERSE_TEXT_RETRY,
  FINAL_SUMMARY_STITCH_SYSTEM_PROMPT,
  FINAL_SUMMARY_SYSTEM_PROMPT,
} from "@/features/session/server/prompts/final-summary";
import {
  buildDensityBriefing,
  countTranscriptWords,
  resolveSummaryDensity,
  type SummaryDensityTarget,
  sliceDensity,
} from "@/features/session/server/summary-density";
import { sliceTranscript } from "@/features/session/server/transcript-slices";
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
 * **São DOIS regimes, e quem escolhe é o tamanho da pregação.** Até
 * `CHUNKED_ABOVE_WORDS` é uma chamada só (`generateInOneCall`); acima disso o
 * sermão é redigido por TRECHO, na ordem, mais uma costura curta que nomeia a
 * mensagem (`generateBySlices`). O porquê está no cabeçalho daquela função.
 *
 * **O que NÃO voltou foi o "enriquecimento"**, uma segunda passada que recebia
 * os blocks já organizados e devolvia inserções de `contextCard` e
 * `relatedVerse`, os comentários do Scriba que a tela desenhava num balão. Ela
 * saiu inteira: prompt, tipos de bloco, rotas de telemetria
 * (`summary-enrichment*`) e o componente. Era a segunda chamada mais cara do
 * produto (entrada com o sermão inteiro de novo) para uma camada que o usuário
 * não usava. A redação por trecho não é ela de volta: aqui cada chamada escreve
 * uma PARTE do mesmo texto, e nenhuma relê o que a outra escreveu.
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
async function generateInOneCall(
  input: GenerateFinalSummaryInput,
  density: SummaryDensityTarget
): Promise<GenerateFinalSummaryResult> {
  const { transcript, notes, logPrefix } = input;
  const log = createLogger(logPrefix);
  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  const trimmedNotes = notes?.trim();
  const userMessage = [
    buildDensityBriefing(density, "inteira"),
    `transcript:
${transcript}`,
    ...(trimmedNotes
      ? [
          `notas do ouvinte:
${trimmedNotes}`,
        ]
      : []),
  ].join("\n\n");

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

/**
 * ## A REDAÇÃO POR TRECHO
 *
 * Acima de `CHUNKED_ABOVE_WORDS` o sermão é redigido em trechos, na ordem, uma
 * chamada por trecho, e um `title`/`shortSummary` costurados no fim.
 *
 * **Por que não bastou pedir.** O alvo de densidade (ver `summary-density.ts`)
 * levou o resumo de 14% para perto da faixa nas pregações médias e não
 * resolveu a longa: com a transcrição inteira na entrada, o modelo decide
 * sozinho o que cabe na resposta, e o que ele corta é sempre o MEIO. Numa
 * exposição de Atos 16 isso apareceu assim: a narrativa (meia-noite, o
 * cântico, o terremoto, a espada erguida, o grito que salvou a vida) virou o
 * rótulo "o episódio de Paulo e Silas no cárcere", e as lições que a pregadora
 * enumerou uma a uma viraram "e daí extrai lições práticas". As duas perdas
 * foram atacadas no prompt, mas pedir cobertura é pedir; dar ao modelo um
 * trecho de cada vez, com a FATIA do alvo que cabe àquele trecho, faz a
 * cobertura ser proporcional por construção.
 *
 * **O preço é real e por isso o regime é condicional.** São N chamadas em vez
 * de uma, mais a costura. A entrada total não muda muito (cada trecho entra
 * uma vez só), mas o system prompt é reenviado a cada trecho e a saída cresce,
 * que é justamente o que se queria. Abaixo do limiar nada disso liga: a
 * pregação média nunca teve esse defeito.
 *
 * **O que cola um trecho no outro** são duas coisas no prompt do seguinte: a
 * lista de movimentos já escritos e o último parágrafo redigido. A primeira
 * impede que ele reescreva o que já foi dito; a segunda diz onde o texto
 * parou, e sem ela os dois trechos vizinhos abriam movimentos sobre o mesmo
 * assunto, um de cada lado do corte. Não há sobreposição de TEXTO entre os
 * trechos (ver `transcript-slices.ts`).
 */
const CHUNKED_ABOVE_WORDS = 2_600;
/** Palavras faladas por trecho, o alvo que decide QUANTOS trechos haverá. */
const WORDS_PER_SLICE = 1_700;
/** Teto de trechos: acima disso o custo deixa de se pagar. */
const MAX_SLICES = 6;
/**
 * Quantas anotações o resumo responde, no máximo. O mesmo número que o prompt
 * pede, aplicado aqui porque o prompt não tem como contar o que os outros
 * trechos emitiram. Ver `noteReply` em `lib/domain/summary.ts`.
 */
const MAX_NOTE_REPLIES = 3;

function sliceCountFor(words: number): number {
  if (words <= CHUNKED_ABOVE_WORDS) return 1;
  return Math.min(MAX_SLICES, Math.max(2, Math.round(words / WORDS_PER_SLICE)));
}

/**
 * Título e ideia central da mensagem INTEIRA, a partir do esqueleto que os
 * trechos escreveram. Falha dela NUNCA derruba o resumo: os blocks já estão
 * escritos e pagos, e um resumo sem título é infinitamente melhor que um erro.
 */
async function stitchTitle(params: {
  input: GenerateFinalSummaryInput;
  log: ReturnType<typeof createLogger>;
  model: string;
  blocks: SummaryPayload["blocks"];
}): Promise<{ title: string; shortSummary: string; latencyMs: number }> {
  const { input, log, model, blocks } = params;
  const skeleton = blocks
    .filter((b) => b.type === "h1" || b.type === "conclusion")
    .map((b) => (b.type === "h1" ? `movimento: ${b.text}` : `conclusão: ${b.text}`))
    .join("\n");

  const firstMovement = blocks.find((b) => b.type === "h1");
  const fallbackTitle = firstMovement && "text" in firstMovement ? firstMovement.text : "";

  const result = await callChat({
    model,
    temperature: 0.2,
    maxTokens: 400,
    timeoutMs: 60_000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: FINAL_SUMMARY_STITCH_SYSTEM_PROMPT },
      { role: "user", content: skeleton },
    ],
    store: true,
    metadata: buildLlmMetadata({
      route: input.metadataRoute,
      userId: input.userId,
      sessionId: input.sessionId,
    }),
  });

  if (!result.ok) {
    log.warn(`costura falhou, título vem do primeiro movimento`, {
      error: result.error.message,
    });
    return { title: fallbackTitle, shortSummary: "", latencyMs: 0 };
  }

  await recordChatUsage({
    userId: input.userId,
    sessionId: input.sessionId,
    route: input.metadataRoute,
    model,
    promptTokens: result.data.usage.promptTokens,
    completionTokens: result.data.usage.completionTokens,
    cachedTokens: result.data.usage.cachedTokens,
    reasoningTokens: result.data.usage.reasoningTokens,
    latencyMs: result.data.latencyMs,
  });

  let title = fallbackTitle;
  let shortSummary = "";
  try {
    const parsed = JSON.parse(result.data.content) as Record<string, unknown>;
    if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim();
    if (typeof parsed.shortSummary === "string") shortSummary = parsed.shortSummary.trim();
  } catch {
    log.warn(`costura devolveu JSON inválido, título vem do primeiro movimento`);
  }

  return { title, shortSummary, latencyMs: result.data.latencyMs };
}

async function generateBySlices(
  input: GenerateFinalSummaryInput,
  density: SummaryDensityTarget,
  sliceCount: number
): Promise<GenerateFinalSummaryResult> {
  const { transcript, notes, logPrefix } = input;
  const log = createLogger(logPrefix);
  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;
  const trimmedNotes = notes?.trim();

  const slices = sliceTranscript(transcript, sliceCount);
  const blocks: SummaryPayload["blocks"] = [];
  const movements: string[] = [];
  /** As anotações já respondidas, para nenhuma ser respondida duas vezes. */
  const answeredNotes = new Set<string>();
  let latencyMs = 0;
  let lastError: GenerateFinalSummaryError | null = null;

  for (const slice of slices) {
    const target = sliceDensity(density, slice.words);
    const position = slice.isLast
      ? " (este é o trecho FINAL: feche com o bloco conclusion)"
      : " (NÃO é o trecho final: nenhum bloco conclusion)";
    // A emenda entre um trecho e o outro. Os movimentos impedem que o próximo
    // reescreva o que já foi dito; o último parágrafo diz ONDE o texto parou,
    // e sem ele os dois trechos vizinhos abriam movimentos sobre o mesmo
    // assunto, um de cada lado do corte.
    const lastParagraph = [...blocks].reverse().find((b) => b.type === "paragraph");
    const written =
      movements.length > 0
        ? [
            "movimentos já escritos nos trechos anteriores (não repita nenhum):",
            movements.map((m) => `- ${m}`).join("\n"),
            lastParagraph && "text" in lastParagraph
              ? `o texto parou aqui (continue daqui, não recomece):\n${lastParagraph.text}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "este é o começo da pregação.";

    const userMessage = [
      `trecho ${slice.index} de ${slices.length}${position}`,
      buildDensityBriefing(target, "trecho"),
      written,
      `transcript (trecho ${slice.index}):\n${slice.text}`,
      ...(trimmedNotes
        ? [
            `notas do ouvinte:\n${trimmedNotes}`,
            // O teto de 3 "noteReply" é do resumo INTEIRO, e cada trecho é uma
            // chamada que não vê as outras: sem esta linha, uma pregação de
            // cinco trechos sairia com cinco respostas à mesma anotação.
            slice.index === 1
              ? 'você pode emitir blocks "noteReply" aqui (no máximo 3 no resumo inteiro).'
              : 'os trechos anteriores já puderam responder às anotações: só emita "noteReply" aqui se a anotação falar de algo que aparece NESTE trecho e ainda não foi respondido.',
          ]
        : []),
    ].join("\n\n");

    const attempt = await attemptFinalSummary({
      input,
      log,
      model,
      systemPrompt: FINAL_SUMMARY_SYSTEM_PROMPT + FINAL_SUMMARY_CHUNK_SUFFIX,
      userMessage,
    });

    if (!attempt.ok) {
      // Um trecho que falha não derruba os que deram certo: a pessoa já pagou,
      // e um resumo com quatro dos cinco trechos é muito melhor que um 502.
      log.warn(`trecho falhou, seguindo com os demais`, {
        slice: slice.index,
        of: slices.length,
        kind: attempt.kind,
      });
      lastError = attempt;
      continue;
    }

    latencyMs += attempt.latencyMs;
    // A conclusão de um trecho que não é o último é descartada AQUI, não
    // pedida: um fecho no meio encerra um texto que continua, e o modelo erra
    // isso de vez em quando.
    for (const block of attempt.payload.blocks) {
      if (block.type === "conclusion" && !slice.isLast) continue;
      // A resposta à anotação é do resumo INTEIRO, e cada trecho é uma chamada
      // que não vê as outras: o prompt pede que os seguintes se contenham, e
      // pedir não basta — medido, o terceiro trecho reescreveu a resposta que o
      // primeiro já tinha dado, palavra por palavra diferente e conteúdo igual.
      // O teto e a repetição são GARANTIDOS aqui.
      if (block.type === "noteReply") {
        const key = block.note.trim().toLowerCase();
        if (answeredNotes.size >= MAX_NOTE_REPLIES || answeredNotes.has(key)) continue;
        answeredNotes.add(key);
      }
      if (block.type === "h1") movements.push(block.text);
      blocks.push(block);
    }

    log.debug(`trecho pronto`, {
      slice: slice.index,
      of: slices.length,
      sliceWords: slice.words,
      targetWords: target.targetWords,
      blocks: attempt.payload.blocks.length,
    });
  }

  if (blocks.length === 0) {
    if (lastError) return lastError;
    return {
      ok: false,
      kind: "empty",
      message: `nenhum trecho devolveu bloco (${slices.length} trechos)`,
      latencyMs,
    };
  }

  const stitched = await stitchTitle({ input, log, model, blocks });
  latencyMs += stitched.latencyMs;

  log.info(`resumo por trechos`, {
    slices: slices.length,
    blocks: blocks.length,
    movements: movements.length,
    latencyMs,
  });

  return {
    ok: true,
    payload: {
      thinking: "",
      title: stitched.title,
      shortSummary: stitched.shortSummary,
      blocks,
    },
    latencyMs,
    model,
  };
}

/**
 * A porta de entrada das três rotas. Ela só escolhe o REGIME: uma chamada para
 * a pregação média, redação por trecho para a longa. Ver `generateBySlices`.
 */
export async function generateFinalSummary(
  input: GenerateFinalSummaryInput
): Promise<GenerateFinalSummaryResult> {
  const log = createLogger(input.logPrefix);
  const density = resolveSummaryDensity(countTranscriptWords(input.transcript));
  const slices = sliceCountFor(density.transcriptWords);

  log.debug(`alvo de densidade`, {
    transcriptWords: density.transcriptWords,
    targetWords: density.targetWords,
    movements: density.movements,
    blocks: `${density.minBlocks}-${density.maxBlocks}`,
    slices,
  });

  return slices > 1 ? generateBySlices(input, density, slices) : generateInOneCall(input, density);
}
