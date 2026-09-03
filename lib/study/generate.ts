import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  parseStudyAnswersFromLLM,
  parseStudyFromLLM,
  parseStudyQuestionsFromLLM,
  type StudyAnswer,
  type StudyPayload,
  type StudyRecord,
  type StudyTopic,
} from "@/lib/domain/study";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { STUDY_ANSWERS_SYSTEM_PROMPT } from "@/lib/prompts/study-answers";
import { STUDY_QUESTIONS_SYSTEM_PROMPT } from "@/lib/prompts/study-questions";
import { STUDY_WRITE_SYSTEM_PROMPT } from "@/lib/prompts/study-write";
import { renderTheologianBriefing, theologiansFor } from "@/lib/prompts/theologians";
import { anchorReferences, renderAnchoredPassages } from "@/lib/study/anchor";
import { sealStudy } from "@/lib/study/seal";

/**
 * O pipeline do estudo.
 *
 *     resumo  responde  →  o que foi ensinado nesta pregação?
 *     estudo  responde  →  agora que entendi o tema, o que preciso aprender
 *                          sobre ele?
 *
 * Cinco etapas, três de LLM e duas determinísticas:
 *
 *   [1] QUESTIONADOR  LLM  interroga o sermão como um crítico: 25-30 perguntas
 *   [2] RESPONDEDOR   LLM  ESCOLHE as 10-14 que rendem e responde todas juntas
 *   [3] ANCORAGEM     ---  resolve as referências bíblicas citadas na NVI
 *   [4] REDATOR       LLM  transforma as respostas num artigo corrido
 *   [5] SELAGEM       ---  versículo vem da NVI; fonte sem obra é descartada
 *
 * A representação intermediária ser PERGUNTA, e não uma taxonomia de eixos e
 * disciplinas, é a decisão que carrega o resto: uma pergunta é autovalidável —
 * dá para ler e saber se presta — enquanto um eixo com abordagem escolhida é
 * um formulário preenchido que nada diz sobre a qualidade do que virá.
 *
 * Daí a assimetria de esforço: **a qualidade do estudo é a qualidade das
 * perguntas**. O passo 1 pergunta sem pudor e NÃO seleciona; a seleção mora no
 * passo 2, com quem vai ter de responder — quem melhor julga se uma pergunta
 * vale é quem precisa respondê-la.
 *
 * Persistência é do chamador. Usado por `/api/deepening` e
 * `/api/deepening/reprocess`.
 */

export type GenerateStudySuccess = {
  ok: true;
  payload: StudyPayload;
  /** Perguntas levantadas e o recorte respondido. Persistido para avaliação. */
  record: StudyRecord;
  latencyMs: number;
  model: string;
};

export type GenerateStudyError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  /** Parada dura do pipeline. Nenhuma delas grava estudo pela metade. */
  | { ok: false; kind: "pipeline"; message: string };

export type GenerateStudyResult = GenerateStudySuccess | GenerateStudyError;

export type GenerateStudyInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  feedItems: FeedItem[];
  finalSummary: SummaryPayload;
  logPrefix: string;
};

/**
 * Teto da transcrição enviada ao passo 2. O passo 1 recebe a íntegra — é ele
 * que precisa dela para achar o que perguntar. Depois disso o material de
 * trabalho são as perguntas e as respostas, e remandar quarenta minutos de
 * fala infla o prompt sem melhorar o texto. O passo 4 não recebe transcrição
 * nenhuma: ele escreve sobre o ASSUNTO, não sobre a gravação.
 */
const TRANSCRIPT_CAP = 20_000;

/**
 * As chamadas do respondedor e do redator são grandes — 10-14 respostas de até
 * 350 palavras, e depois um artigo inteiro. O padrão de `callChat` é 60s, curto
 * demais para elas, e um timeout aqui aborta um trabalho pelo qual o usuário já
 * pagou moedas.
 */
const LONG_CALL_TIMEOUT_MS = 180_000;

function capTranscript(transcript: string): string {
  if (transcript.length <= TRANSCRIPT_CAP) return transcript;
  return `${transcript.slice(0, TRANSCRIPT_CAP)}\n\n[transcrição truncada]`;
}

export async function generateStudy(input: GenerateStudyInput): Promise<GenerateStudyResult> {
  const { userId, sessionId, transcript, feedItems, finalSummary, logPrefix } = input;
  const log = createLogger(logPrefix);

  // ── [1] QUESTIONADOR ─────────────────────────────────────────────────────
  const questionsModel = serverEnv.OPENAI_STUDY_QUESTIONS_MODEL;
  const qLog = log.scoped("questions");

  const questionsResult = await callChat({
    model: questionsModel,
    // Alta: aqui queremos amplitude e ângulos improváveis. Perguntar demais é
    // barato — a seleção vem depois. Uma boa pergunta não feita está perdida
    // para sempre.
    temperature: 0.9,
    maxTokens: 6000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_QUESTIONS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `summary:\n${JSON.stringify(finalSummary)}`,
          `feedItems:\n${JSON.stringify(feedItems)}`,
          `transcript:\n${transcript}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "study-questions", userId, sessionId }),
  });

  if (!questionsResult.ok) return upstreamFailure(qLog, questionsResult.error);
  await recordUsage(sessionId, "study-questions", questionsModel, questionsResult.data);

  const record = parseStudyQuestionsFromLLM(questionsResult.data.content);
  if (!record) {
    qLog.error("nenhuma pergunta utilizável — abortando");
    return { ok: false, kind: "pipeline", message: "questions_unusable" };
  }

  qLog.debug("ok", {
    theme: record.theme,
    total: record.questions.length,
    alta: record.questions.filter((q) => q.depth === "alta").length,
    latencyMs: questionsResult.data.latencyMs,
  });

  // Autores pertinentes ao conjunto dos temas levantados. Respondedor e
  // redator recebem os MESMOS, senão o segundo cita gente que o primeiro não
  // trabalhou.
  const topics = [...new Set(record.questions.flatMap((q) => q.topics))] as StudyTopic[];
  const authorsBlock = renderTheologianBriefing(theologiansFor(topics));

  // ── [2] RESPONDEDOR — seleciona e responde ───────────────────────────────
  const answersModel = serverEnv.OPENAI_STUDY_ANSWERS_MODEL;
  const aLog = log.scoped("answers");

  const answersResult = await callChat({
    model: answersModel,
    // Média: precisa de liberdade para formular, mas é a etapa que carrega os
    // fatos, e temperatura alta aqui vira citação inventada.
    temperature: 0.5,
    maxTokens: 16000,
    timeoutMs: LONG_CALL_TIMEOUT_MS,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_ANSWERS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `theme:\n${record.theme}`,
          `questions:\n${JSON.stringify(record.questions)}`,
          `authors:\n${authorsBlock}`,
          `summary:\n${JSON.stringify(finalSummary)}`,
          `transcript:\n${capTranscript(transcript)}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "study-answers", userId, sessionId }),
  });

  if (!answersResult.ok) return upstreamFailure(aLog, answersResult.error);
  await recordUsage(sessionId, "study-answers", answersModel, answersResult.data);

  const answers = parseStudyAnswersFromLLM(answersResult.data.content);
  if (answers.length === 0) {
    aLog.error("nenhuma resposta — abortando");
    return { ok: false, kind: "pipeline", message: "answers_empty" };
  }

  record.answered = answers.map((a) => a.question);
  aLog.debug("ok", {
    asked: record.questions.length,
    answered: answers.length,
    withTension: answers.filter((a) => a.tension).length,
    latencyMs: answersResult.data.latencyMs,
  });
  if (answersResult.data.finishReason === "length") {
    aLog.warn("saída truncada por max_tokens", {
      completionTokens: answersResult.data.usage.completionTokens,
    });
  }

  // ── [3] ANCORAGEM (sem LLM) ──────────────────────────────────────────────
  const { anchored, dropped } = await anchorReferences(answers.flatMap((a) => a.passages));
  if (dropped.length > 0) {
    // Taxa alta aqui = o respondedor está inventando referência. É um sinal
    // que só existe porque medimos.
    log.warn("referências descartadas na ancoragem", {
      dropped: dropped.join(" | "),
      kept: anchored.length,
    });
  }

  // ── [4] REDATOR ──────────────────────────────────────────────────────────
  const writeModel = serverEnv.OPENAI_STUDY_WRITE_MODEL;
  const wLog = log.scoped("write");

  const writeResult = await callChat({
    model: writeModel,
    // Alta: é a etapa de prosa, e a substância já está fixada nas respostas.
    // A temperatura aqui muda como o texto é escrito, não o que ele afirma.
    temperature: 0.75,
    maxTokens: 16000,
    timeoutMs: LONG_CALL_TIMEOUT_MS,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_WRITE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `theme:\n${record.theme}`,
          `answers:\n${JSON.stringify(answers.map(stripPassages))}`,
          `anchoredPassages:\n${renderAnchoredPassages(anchored)}`,
          `authors:\n${authorsBlock}`,
          `summary:\n${JSON.stringify(finalSummary)}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "study-write", userId, sessionId }),
  });

  if (!writeResult.ok) return upstreamFailure(wLog, writeResult.error);
  await recordUsage(sessionId, "study-write", writeModel, writeResult.data);

  const draft = parseStudyFromLLM(writeResult.data.content);
  wLog.debug("ok", {
    blocks: draft.blocks.length,
    latencyMs: writeResult.data.latencyMs,
    finishReason: writeResult.data.finishReason,
  });
  if (writeResult.data.finishReason === "length") {
    wLog.warn("saída truncada por max_tokens", {
      completionTokens: writeResult.data.usage.completionTokens,
    });
  }
  if (draft.blocks.length === 0) {
    wLog.error("redação vazia — abortando");
    return { ok: false, kind: "pipeline", message: "draft_empty" };
  }

  // ── [5] SELAGEM (sem LLM) ────────────────────────────────────────────────
  const { payload, report } = sealStudy(draft, anchored);
  log.debug("selado", { blocks: payload.blocks.length, ...report });

  if (payload.blocks.length === 0) {
    log.error("selagem esvaziou o estudo");
    return { ok: false, kind: "pipeline", message: "sealed_empty" };
  }

  return {
    ok: true,
    payload,
    record,
    latencyMs: writeResult.data.latencyMs,
    model: writeModel,
  };
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

/**
 * O redator não precisa da lista crua de referências: ele recebe
 * `anchoredPassages`, que já é o subconjunto que existe de verdade. Mandar as
 * duas listas convidaria a citar uma referência que a ancoragem descartou.
 */
function stripPassages(answer: StudyAnswer): Omit<StudyAnswer, "passages"> {
  const { passages: _dropped, ...rest } = answer;
  return rest;
}

type ChatOk = Extract<Awaited<ReturnType<typeof callChat>>, { ok: true }>["data"];

async function recordUsage(
  sessionId: string,
  route: UsageRoute,
  model: string,
  data: ChatOk
): Promise<void> {
  await recordChatUsage({
    sessionId,
    route,
    model,
    promptTokens: data.usage.promptTokens,
    completionTokens: data.usage.completionTokens,
    cachedTokens: data.usage.cachedTokens,
    latencyMs: data.latencyMs,
  });
}

type ChatErr = Extract<Awaited<ReturnType<typeof callChat>>, { ok: false }>["error"];

function upstreamFailure(log: ReturnType<typeof createLogger>, error: ChatErr): GenerateStudyError {
  if (error.kind === "fetch") {
    log.error("upstream fetch falhou", { error: error.message });
    return { ok: false, kind: "fetch", message: error.message };
  }
  log.error("upstream erro", {
    status: error.status,
    latencyMs: error.latencyMs,
    snippet: error.snippet.slice(0, 300),
  });
  return {
    ok: false,
    kind: "upstream",
    message: error.message,
    status: error.status,
    latencyMs: error.latencyMs,
  };
}
