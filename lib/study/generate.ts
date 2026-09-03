import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  parseStudyFromLLM,
  parseStudyPlanFromLLM,
  type StudyPayload,
  type StudyPlan,
} from "@/lib/domain/study";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { STUDY_AUDIT_SYSTEM_PROMPT } from "@/lib/prompts/study-audit";
import { STUDY_PLAN_SYSTEM_PROMPT } from "@/lib/prompts/study-plan";
import { STUDY_WRITE_SYSTEM_PROMPT } from "@/lib/prompts/study-write";
import { renderTheologianBriefing, theologiansFor } from "@/lib/prompts/theologians";
import { type AnchoredPassage, anchorPlan, renderAnchoredPassages } from "@/lib/study/anchor";
import { sealStudy } from "@/lib/study/seal";

/**
 * O pipeline do estudo — cinco etapas, três chamadas de modelo, duas
 * determinísticas. Diagnóstico e desenho completos em `docs/estudo-v2.md`.
 *
 *   [1] PLANO      LLM   decide o tema, os eixos e a disciplina de cada eixo
 *   [2] ANCORAGEM  ---   resolve toda referência bíblica contra a NVI local
 *   [3] REDAÇÃO    LLM   escreve seguindo o plano e os versículos conferidos
 *   [4] REVISÃO    LLM   corta o que a transcrição e as fontes não sustentam
 *   [5] SELAGEM    ---   reescreve versículo da NVI, descarta fonte sem obra
 *
 * A versão anterior era uma chamada única a 16k tokens que decidia, escrevia e
 * se auto-auditava ao mesmo tempo, seguida de um auditor que não recebia a
 * transcrição. O que ela produzia era estudo genérico com fontes plausíveis —
 * as sete causas estão em `docs/estudo-v2.md` §1.
 *
 * Persistência é do chamador. Usado por:
 *   - POST /api/deepening            (primeira geração)
 *   - POST /api/deepening/reprocess  (refazer sobre um estudo existente)
 */

export type GenerateStudySuccess = {
  ok: true;
  payload: StudyPayload;
  /** Persistido junto do estudo: é o que torna a decisão editorial avaliável. */
  plan: StudyPlan;
  latencyMs: number;
  model: string;
};

export type GenerateStudyError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  /** O plano não saiu utilizável. Sem plano não escrevemos — ver abaixo. */
  | { ok: false; kind: "plan"; message: string };

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
 * Teto da transcrição enviada aos passos 3 e 4. O passo 1 recebe a íntegra —
 * ele precisa dela para escolher o tema. Os passos seguintes já têm o plano,
 * e mandar 40 minutos de fala de novo em cada um triplicaria o custo de
 * entrada sem melhorar o texto.
 */
const TRANSCRIPT_CAP = 24_000;

function capTranscript(transcript: string): string {
  if (transcript.length <= TRANSCRIPT_CAP) return transcript;
  return `${transcript.slice(0, TRANSCRIPT_CAP)}\n\n[transcrição truncada]`;
}

export async function generateStudy(input: GenerateStudyInput): Promise<GenerateStudyResult> {
  const { userId, sessionId, transcript, feedItems, finalSummary, logPrefix } = input;
  const log = createLogger(logPrefix);

  // ── [1] PLANO ─────────────────────────────────────────────────────────────
  const planModel = serverEnv.OPENAI_STUDY_PLAN_MODEL;
  const planLog = log.scoped("plan");

  const planResult = await callChat({
    model: planModel,
    // Baixa de propósito: o plano é a decisão que vamos AVALIAR, e uma decisão
    // que muda a cada execução não pode ser avaliada. A variação criativa fica
    // toda no passo 3.
    temperature: 0.3,
    maxTokens: 3000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_PLAN_SYSTEM_PROMPT },
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
    metadata: buildLlmMetadata({ route: "study-plan", userId, sessionId }),
  });

  if (!planResult.ok) return upstreamFailure(planLog, planResult.error);

  await recordUsage(sessionId, "study-plan", planModel, planResult.data);

  const plan = parseStudyPlanFromLLM(planResult.data.content);
  if (!plan) {
    // Falha dura, e deliberadamente: escrever sem plano é exatamente o
    // comportamento antigo. Um estudo sem decisão editorial não é o que
    // estamos vendendo, e devolver 502 aqui é melhor que devolver o produto
    // que esta reforma existe para eliminar.
    planLog.error("plano inválido — abortando");
    return { ok: false, kind: "plan", message: "plan_unusable" };
  }

  planLog.debug("ok", {
    theme: plan.theme,
    depth: plan.depth,
    axes: plan.axes.map((a) => a.approach).join(","),
    latencyMs: planResult.data.latencyMs,
  });

  // ── [2] ANCORAGEM (sem LLM) ──────────────────────────────────────────────
  const { anchored, dropped } = await anchorPlan(plan);
  if (dropped.length > 0) {
    // Taxa alta aqui = o passo do plano está inventando referência. É um sinal
    // que só existe porque medimos; sem ele, a referência inventada seguiria
    // para o texto e sairia como versículo.
    log.warn("referências descartadas na ancoragem", {
      dropped: dropped.join(" | "),
      kept: anchored.length,
    });
  }

  // ── [3] REDAÇÃO ──────────────────────────────────────────────────────────
  const writeModel = serverEnv.OPENAI_STUDY_WRITE_MODEL;
  const writeLog = log.scoped("write");
  const cappedTranscript = capTranscript(transcript);
  const authorsBlock = renderAuthorsForPlan(plan);

  const writeUserMessage = [
    `plan:\n${JSON.stringify(plan)}`,
    `anchoredPassages:\n${renderAnchoredPassages(anchored)}`,
    `authors:\n${authorsBlock}`,
    `summary:\n${JSON.stringify(finalSummary)}`,
    `transcript:\n${cappedTranscript}`,
  ].join("\n\n---\n");

  const writeResult = await callChat({
    model: writeModel,
    // Alta: é a ÚNICA etapa que ganha com variação. O plano já fixou o
    // esqueleto, então a temperatura aqui muda a prosa, não as decisões.
    temperature: 0.7,
    maxTokens: 16000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_WRITE_SYSTEM_PROMPT },
      { role: "user", content: writeUserMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "study-write", userId, sessionId }),
  });

  if (!writeResult.ok) return upstreamFailure(writeLog, writeResult.error);

  await recordUsage(sessionId, "study-write", writeModel, writeResult.data);
  const draft = parseStudyFromLLM(writeResult.data.content);

  writeLog.debug("ok", {
    blocks: draft.blocks.length,
    latencyMs: writeResult.data.latencyMs,
    finishReason: writeResult.data.finishReason,
  });
  if (writeResult.data.finishReason === "length") {
    writeLog.warn("saída truncada por max_tokens", {
      completionTokens: writeResult.data.usage.completionTokens,
    });
  }

  if (draft.blocks.length === 0) {
    writeLog.error("redação vazia — abortando");
    return { ok: false, kind: "plan", message: "draft_empty" };
  }

  // ── [4] REVISÃO ──────────────────────────────────────────────────────────
  // Best-effort, como o enriquecimento do resumo: se o revisor falha, o
  // rascunho selado ainda é entregável. O que NÃO é aceitável é entregar sem
  // passar pela selagem — por isso ela vem depois, fora deste `if`.
  let reviewed = draft;
  const audited = await runAudit({
    userId,
    sessionId,
    plan,
    draft,
    anchored,
    finalSummary,
    transcript: cappedTranscript,
    log: log.scoped("audit"),
  });
  if (audited) reviewed = audited;

  // ── [5] SELAGEM (sem LLM) ────────────────────────────────────────────────
  const { payload, report } = sealStudy(reviewed, anchored);

  log.debug("selado", {
    blocks: payload.blocks.length,
    ...report,
  });
  if (payload.blocks.length === 0) {
    log.error("selagem esvaziou o estudo");
    return { ok: false, kind: "plan", message: "sealed_empty" };
  }

  return {
    ok: true,
    payload,
    plan,
    latencyMs: writeResult.data.latencyMs,
    model: writeModel,
  };
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

/**
 * O briefing de autores, por eixo. O redator recebe seis a doze nomes COM obra
 * e século, escolhidos pelo cruzamento entre a abordagem e os temas do eixo —
 * não os 48 nomes soltos da whitelist antiga. Ver `lib/prompts/theologians.ts`.
 */
function renderAuthorsForPlan(plan: StudyPlan): string {
  return plan.axes
    .map((axis) => {
      const list = theologiansFor(axis.approach, axis.topics);
      return `Eixo "${axis.title}" (${axis.approach}):\n${renderTheologianBriefing(list)}`;
    })
    .join("\n\n");
}

type AuditArgs = {
  userId: string;
  sessionId: string;
  plan: StudyPlan;
  draft: StudyPayload;
  anchored: AnchoredPassage[];
  finalSummary: SummaryPayload;
  transcript: string;
  log: ReturnType<typeof createLogger>;
};

async function runAudit(args: AuditArgs): Promise<StudyPayload | null> {
  const model = serverEnv.OPENAI_STUDY_AUDIT_MODEL;

  const result = await callChat({
    model,
    // Mínima: o revisor corta, não cria. Temperatura aqui só produziria
    // reescrita criativa — que é fabricação com outro nome.
    temperature: 0.1,
    maxTokens: 16000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_AUDIT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `plan:\n${JSON.stringify(args.plan)}`,
          `draft:\n${JSON.stringify(args.draft)}`,
          `anchoredPassages:\n${renderAnchoredPassages(args.anchored)}`,
          `summary:\n${JSON.stringify(args.finalSummary)}`,
          `transcript:\n${args.transcript}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({
      route: "study-audit",
      userId: args.userId,
      sessionId: args.sessionId,
    }),
  });

  if (!result.ok) {
    args.log.warn("revisão falhou — seguindo com o rascunho", {
      kind: result.error.kind,
      message: result.error.message,
    });
    return null;
  }

  await recordUsage(args.sessionId, "study-audit", model, result.data);
  const reviewed = parseStudyFromLLM(result.data.content);

  if (reviewed.blocks.length === 0) {
    args.log.warn("revisão devolveu vazio — mantendo o rascunho");
    return null;
  }

  args.log.debug("ok", {
    draftBlocks: args.draft.blocks.length,
    reviewedBlocks: reviewed.blocks.length,
    latencyMs: result.data.latencyMs,
  });
  return reviewed;
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
