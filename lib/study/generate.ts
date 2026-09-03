import "server-only";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import {
  parseQuestionFilterFromLLM,
  parseStudyAnswersFromLLM,
  parseStudyFromLLM,
  parseStudyQuestionsFromLLM,
  parseThesisCheckFromLLM,
  type StudyAnswer,
  type StudyBlock,
  type StudyPayload,
  type StudyQuestion,
  type StudyRecord,
  type StudyTopic,
} from "@/lib/domain/study";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { STUDY_ANSWERS_SYSTEM_PROMPT } from "@/lib/prompts/study-answers";
import {
  STUDY_QUESTION_FILTER_SYSTEM_PROMPT,
  STUDY_THESIS_CHECK_SYSTEM_PROMPT,
} from "@/lib/prompts/study-guard";
import { STUDY_QUESTIONS_SYSTEM_PROMPT } from "@/lib/prompts/study-questions";
import { STUDY_WRITE_SYSTEM_PROMPT } from "@/lib/prompts/study-write";
import { renderTheologianBriefing, theologiansFor } from "@/lib/prompts/theologians";
import { anchorReferences, renderAnchoredPassages } from "@/lib/study/anchor";
import { resolveCovers } from "@/lib/study/covers";
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
 *   [1] QUESTIONADOR  LLM   interroga o sermão como um crítico: 25-30 perguntas
 *   [1b] GUARDIÃO     mini  corta a pergunta que o resumo já responde
 *   [2] RESPONDEDOR   LLM   ESCOLHE as 10-14 que rendem e responde todas juntas
 *   [3] ANCORAGEM     ---   resolve as referências bíblicas citadas na NVI
 *   [4] REDATOR       LLM   transforma as respostas num artigo corrido
 *   [4b] GUARDIÃO     mini  se a tese repetir a do resumo, manda reescrever
 *   [5] SELAGEM       ---   versículo vem da NVI; fonte sem obra é descartada
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
 * ## O sermão sai do pipeline depois do passo 1
 *
 * Só o questionador vê a transcrição e o resumo. Dali em diante o material de
 * trabalho é um ASSUNTO ("a alegria cristã") e um conjunto de perguntas — o
 * respondedor e o redator não recebem o sermão de forma alguma.
 *
 * É uma decisão de arquitetura, não de prompt, e ela nasceu de uma medição:
 * enquanto os dois recebiam o resumo "para não repetir", a expressão que o
 * pregador cunhou aparecia como título de seção do estudo. Entregar o texto a
 * ser evitado a um modelo que vai escrever é priming, não proteção — o que
 * está no contexto sai na saída. Não entregar resolve estruturalmente o que
 * nenhuma instrução resolvia.
 *
 * Os dois passos do guardião (`lib/prompts/study-guard.ts`) existem contra o
 * modo de falha nº 1 do produto: o estudo sair repetindo o resumo. Os três
 * modelos do pipeline recebem o resumo e são instruídos a não repeti-lo, e a
 * instrução às vezes perde para a inclinação natural de voltar ao ponto mais
 * saliente do contexto. O guardião não instrui — corta. Roda num modelo barato
 * porque as duas tarefas são classificação, não escrita.
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
 * As chamadas do respondedor e do redator são grandes — 8-11 respostas de até
 * 500 palavras, e depois um artigo de 4-5 mil palavras num modelo de
 * raciocínio. Medidas: ~100s cada. O padrão de `callChat` é 60s, e um timeout
 * aqui aborta um trabalho pelo qual o usuário já pagou moedas.
 */
const LONG_CALL_TIMEOUT_MS = 240_000;

/**
 * Depois deste ponto na execução, a reescrita do guardião [4b] não é mais
 * tentada.
 *
 * A rota roda com `maxDuration = 300` (o teto da plataforma), e o pipeline
 * inteiro mede ~255s com gpt-5.1. Uma reescrita são mais ~100s: tentá-la fora
 * do prazo trocaria "estudo com a tese parecida" por "função morta depois de
 * debitar as moedas", que é um estrago maior.
 *
 * Consequência assumida: com os modelos de hoje a reescrita quase nunca vai
 * caber, e o veredito do guardião fica valendo como SINAL (log e
 * `/admin/studies`). Se um modelo mais rápido entrar no lugar, ela volta a
 * caber sozinha, sem mudar nada aqui.
 */
const REWRITE_DEADLINE_MS = 150_000;

export async function generateStudy(input: GenerateStudyInput): Promise<GenerateStudyResult> {
  const { userId, sessionId, transcript, feedItems, finalSummary, logPrefix } = input;
  const log = createLogger(logPrefix);
  const startedAt = Date.now();
  let totalTokens = 0;

  // ── [1] QUESTIONADOR ─────────────────────────────────────────────────────
  const questionsModel = serverEnv.OPENAI_STUDY_QUESTIONS_MODEL;
  const qLog = log.scoped("questions");

  const questionsResult = await callChat({
    model: questionsModel,
    // Alta: aqui queremos amplitude e ângulos improváveis. Perguntar demais é
    // barato — a seleção vem depois. Uma boa pergunta não feita está perdida
    // para sempre.
    temperature: 0.9,
    maxTokens: 8000,
    // Esforço baixo de propósito: levantar trinta perguntas é divergência, não
    // dedução. O raciocínio profundo aqui custa quase um minuto de espera e
    // tende a CONVERGIR — e convergir é o oposto do que se quer de quem
    // pergunta.
    reasoningEffort: "low",
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
  totalTokens += await recordUsage(
    sessionId,
    "study-questions",
    questionsModel,
    questionsResult.data
  );

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

  // ── [1b] GUARDIÃO — corta a pergunta que o resumo já responde ────────────
  // O corte mais barato do pipeline e o de melhor rendimento: uma pergunta
  // descartada aqui economiza uma resposta E o trecho do artigo que sairia
  // dela. Melhor-esforço — se o guardião falhar, seguimos com todas.
  const blocked = await filterQuestions({
    userId,
    sessionId,
    questions: record.questions,
    finalSummary,
    log: log.scoped("guard"),
  });
  const surviving = record.questions.filter((q) => !blocked.includes(q.text));
  record.guard = { blockedByGuard: blocked, rewrites: 0 };

  // Se o guardião reprovou quase tudo, o problema está no questionador — e
  // responder as duas sobras produziria um estudo raquítico. Seguir com todas
  // é o mal menor: repetição é pior que nada, mas nada é pior que os dois.
  const questionsForAnswering = surviving.length >= 6 ? surviving : record.questions;
  if (surviving.length < 6 && blocked.length > 0) {
    log.warn("guardião cortou perguntas demais — seguindo com todas", {
      asked: record.questions.length,
      surviving: surviving.length,
    });
  }

  // Autores pertinentes ao conjunto dos temas levantados. Respondedor e
  // redator recebem os MESMOS, senão o segundo cita gente que o primeiro não
  // trabalhou.
  const topics = [...new Set(questionsForAnswering.flatMap((q) => q.topics))] as StudyTopic[];
  const authorsBlock = renderTheologianBriefing(theologiansFor(topics));

  // ── [2] RESPONDEDOR — seleciona e responde ───────────────────────────────
  const answersModel = serverEnv.OPENAI_STUDY_ANSWERS_MODEL;
  const aLog = log.scoped("answers");

  const answersResult = await callChat({
    model: answersModel,
    // Média: precisa de liberdade para formular, mas é a etapa que carrega os
    // fatos, e temperatura alta aqui vira citação inventada.
    temperature: 0.5,
    // Sem esforço explícito: o padrão da API já entrega a densidade que esta
    // etapa precisa, e "medium" media 195s contra ~120s — quase um minuto a
    // mais de espera, dentro de um orçamento de função que é de 300s.
    maxTokens: 16000,
    timeoutMs: LONG_CALL_TIMEOUT_MS,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_ANSWERS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `subject:\n${record.theme}`,
          `questions:\n${JSON.stringify(questionsForAnswering)}`,
          `authors:\n${authorsBlock}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "study-answers", userId, sessionId }),
  });

  if (!answersResult.ok) return upstreamFailure(aLog, answersResult.error);
  totalTokens += await recordUsage(sessionId, "study-answers", answersModel, answersResult.data);

  const answers = parseStudyAnswersFromLLM(answersResult.data.content);
  if (answers.length === 0) {
    aLog.error("nenhuma resposta — abortando");
    return { ok: false, kind: "pipeline", message: "answers_empty" };
  }

  record.answered = answers.map((a) => a.question);
  // `avgWords` é a telemetria que revelou o gargalo do pipeline: as respostas
  // saíam densas e o redator devolvia um quarto disso. Sem medir os dois lados,
  // "o estudo está raso" não diz em qual etapa mexer.
  const answerWords = Math.round(
    answers.reduce((n, a) => n + a.text.split(/\s+/).length, 0) / answers.length
  );
  aLog.debug("ok", {
    asked: questionsForAnswering.length,
    answered: answers.length,
    avgWords: answerWords,
    withSources: answers.filter((a) => a.sources.length > 0).length,
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
  const wLog = log.scoped("write");
  const writeArgs = {
    userId,
    sessionId,
    theme: record.theme,
    answers,
    anchoredBlock: renderAnchoredPassages(anchored),
    authorsBlock,
    log: wLog,
  };

  const written = await runWriter(writeArgs, null);
  if (!written.ok) return written.error;
  let draft = written.payload;

  // ── [4b] GUARDIÃO — a tese avança em relação à do resumo? ────────────────
  // O filtro do passo 1b não alcança esta falha: mesmo partindo de perguntas
  // boas, o redator pode colapsar o artigo de volta na tese do sermão na hora
  // de amarrar tudo. UMA reescrita, com a sobreposição nomeada.
  const verdict = await checkThesis({
    userId,
    sessionId,
    finalSummary,
    draft,
    log: log.scoped("guard"),
  });

  const elapsed = Date.now() - startedAt;
  if (verdict.repeats && elapsed > REWRITE_DEADLINE_MS) {
    wLog.warn("tese repete o resumo, mas não há prazo para reescrever", {
      overlap: verdict.overlap,
      elapsedMs: elapsed,
    });
  } else if (verdict.repeats) {
    wLog.warn("tese repete o resumo — reescrevendo uma vez", { overlap: verdict.overlap });
    const retry = await runWriter(writeArgs, verdict.overlap);
    if (retry.ok && retry.payload.blocks.length > 0) {
      draft = retry.payload;
      record.guard = { ...(record.guard ?? { blockedByGuard: [] }), rewrites: 1 };
    }
    // Segunda falha não aborta: o usuário já pagou, e entregar um estudo
    // imperfeito é melhor que cobrar moedas e devolver 502. Fica o warn.
  }

  if (draft.blocks.length === 0) {
    wLog.error("redação vazia — abortando");
    return { ok: false, kind: "pipeline", message: "draft_empty" };
  }

  // ── [5] SELAGEM (sem LLM) ────────────────────────────────────────────────
  // As capas dos livros indicados. Melhor-esforço e opcional: sem
  // GOOGLE_BOOKS_API_KEY isto devolve um mapa vazio sem chamar ninguém, e a UI
  // desenha uma capa tipográfica. Nunca atrasa nem derruba o estudo.
  const covers = await resolveCovers(
    draft.blocks
      .filter((b): b is Extract<StudyBlock, { type: "reading" }> => b.type === "reading")
      .map((b) => ({ author: b.author, title: b.title }))
  ).catch(() => new Map<string, string>());

  const { payload, report } = sealStudy(draft, anchored, covers);
  log.info("estudo pronto", {
    blocks: payload.blocks.length,
    words: payload.blocks.reduce((n, b) => n + ("text" in b ? b.text.split(/\s+/).length : 0), 0),
    // Duração e tokens no MESMO evento porque as duas perguntas que se faz
    // sobre esta rota são "por que demora tanto?" e "quanto custa?", e elas se
    // respondem juntas. O custo em reais sai em /admin/usage.
    durationMs: Date.now() - startedAt,
    totalTokens,
    ...report,
  });

  if (payload.blocks.length === 0) {
    log.error("selagem esvaziou o estudo");
    return { ok: false, kind: "pipeline", message: "sealed_empty" };
  }

  return {
    ok: true,
    payload,
    record,
    latencyMs: written.latencyMs,
    model: serverEnv.OPENAI_STUDY_WRITE_MODEL,
  };
}

// ── O redator, isolado para poder rodar duas vezes ───────────────────────────

type WriteArgs = {
  userId: string;
  sessionId: string;
  theme: string;
  answers: StudyAnswer[];
  anchoredBlock: string;
  authorsBlock: string;
  log: ReturnType<typeof createLogger>;
};

type WriteOutcome =
  | { ok: true; payload: StudyPayload; latencyMs: number }
  | { ok: false; error: GenerateStudyError };

/**
 * `avoid` só vem preenchido na segunda tentativa: é a sobreposição que o
 * guardião nomeou. Ela entra como mensagem SEPARADA, e não costurada no
 * conteúdo, para o modelo lê-la como correção e não como mais um dado.
 */
async function runWriter(args: WriteArgs, avoid: string | null): Promise<WriteOutcome> {
  const model = serverEnv.OPENAI_STUDY_WRITE_MODEL;
  const result = await callChat({
    model,
    // Alta: é a etapa de prosa, e a substância já está fixada nas respostas.
    // A temperatura aqui muda como o texto é escrito, não o que ele afirma.
    temperature: 0.75,
    // Baixo: montar prosa a partir de material já pronto é composição, não
    // dedução. O que o redator precisa é fôlego de escrita, e isso vem do
    // orçamento de blocos do prompt, não do raciocínio.
    reasoningEffort: "low",
    maxTokens: 16000,
    timeoutMs: LONG_CALL_TIMEOUT_MS,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_WRITE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `subject:\n${args.theme}`,
          `answers:\n${JSON.stringify(args.answers.map(stripPassages))}`,
          `anchoredPassages:\n${args.anchoredBlock}`,
          `authors:\n${args.authorsBlock}`,
        ].join("\n\n---\n"),
      },
      ...(avoid
        ? [
            {
              role: "user" as const,
              content: `A versão anterior deste artigo foi recusada: a tese dela apenas repetia a do resumo. Sobreposição apontada: "${avoid}". Escreva de novo, partindo do mesmo material, com uma tese que AVANCE em relação a essa. Mesmo tema, afirmação diferente.`,
            },
          ]
        : []),
    ],
    store: true,
    metadata: buildLlmMetadata({
      route: "study-write",
      userId: args.userId,
      sessionId: args.sessionId,
    }),
  });

  if (!result.ok) return { ok: false, error: upstreamFailure(args.log, result.error) };
  await recordUsage(args.sessionId, "study-write", model, result.data);

  const payload = parseStudyFromLLM(result.data.content);
  args.log.debug("ok", {
    blocks: payload.blocks.length,
    words: payload.blocks.reduce((n, b) => n + ("text" in b ? b.text.split(/\s+/).length : 0), 0),
    retry: avoid !== null,
    latencyMs: result.data.latencyMs,
    finishReason: result.data.finishReason,
  });
  if (result.data.finishReason === "length") {
    args.log.warn("saída truncada por max_tokens", {
      completionTokens: result.data.usage.completionTokens,
    });
  }
  return { ok: true, payload, latencyMs: result.data.latencyMs };
}

// ── O guardião ───────────────────────────────────────────────────────────────

/**
 * Resumo condensado para os prompts do guardião: a tese mais o texto dos
 * blocos. Mandar o JSON inteiro gastaria tokens num modelo barato para
 * carregar campos que ele não usa.
 */
function condenseSummary(summary: SummaryPayload): string {
  const body = summary.blocks
    .map((b) => ("text" in b ? b.text : ""))
    .filter(Boolean)
    .join(" ");
  return `TESE: ${summary.shortSummary}\n\nCONTEÚDO: ${body}`.slice(0, 8000);
}

async function filterQuestions(args: {
  userId: string;
  sessionId: string;
  questions: StudyQuestion[];
  finalSummary: SummaryPayload;
  log: ReturnType<typeof createLogger>;
}): Promise<string[]> {
  const model = serverEnv.OPENAI_STUDY_GUARD_MODEL;
  const result = await callChat({
    model,
    // Zero: é classificação. Variação aqui só produziria cortes inconsistentes
    // entre duas execuções sobre o mesmo material. (Num modelo de raciocínio a
    // temperatura é ignorada — ver `callChat`; o que vale ali é o esforço.)
    temperature: 0,
    reasoningEffort: "low",
    maxTokens: 4000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_QUESTION_FILTER_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `resumo:\n${condenseSummary(args.finalSummary)}`,
          `perguntas:\n${args.questions.map((q) => q.text).join("\n")}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({
      route: "study-guard",
      userId: args.userId,
      sessionId: args.sessionId,
    }),
  });

  if (!result.ok) {
    // Melhor-esforço: sem o filtro o estudo ainda sai, só com mais risco de
    // repetir. Derrubar a geração por causa do guardião seria trocar um
    // problema de qualidade por um de disponibilidade.
    args.log.warn("filtro de perguntas falhou — seguindo com todas", {
      message: result.error.message,
    });
    return [];
  }
  await recordUsage(args.sessionId, "study-guard", model, result.data);

  const blocked = parseQuestionFilterFromLLM(result.data.content, args.questions);
  args.log.debug("filtro ok", { asked: args.questions.length, blocked: blocked.length });
  return blocked;
}

async function checkThesis(args: {
  userId: string;
  sessionId: string;
  finalSummary: SummaryPayload;
  draft: StudyPayload;
  log: ReturnType<typeof createLogger>;
}): Promise<{ repeats: boolean; overlap: string }> {
  const model = serverEnv.OPENAI_STUDY_GUARD_MODEL;
  const headings = (payload: { blocks: { type: string; text?: string }[] }) =>
    payload.blocks
      .filter((b) => b.type === "h1")
      .map((b) => b.text ?? "")
      .join(" · ");

  const result = await callChat({
    model,
    temperature: 0,
    reasoningEffort: "low",
    maxTokens: 2000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: STUDY_THESIS_CHECK_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `teseDoResumo:\n${args.finalSummary.shortSummary}`,
          `secoesDoResumo:\n${headings(args.finalSummary)}`,
          `teseDoEstudo:\n${args.draft.shortSummary}`,
          `secoesDoEstudo:\n${headings(args.draft)}`,
        ].join("\n\n---\n"),
      },
    ],
    store: true,
    metadata: buildLlmMetadata({
      route: "study-guard",
      userId: args.userId,
      sessionId: args.sessionId,
    }),
  });

  if (!result.ok) {
    args.log.warn("checagem de tese falhou — aceitando o texto", {
      message: result.error.message,
    });
    return { repeats: false, overlap: "" };
  }
  await recordUsage(args.sessionId, "study-guard", model, result.data);

  const verdict = parseThesisCheckFromLLM(result.data.content);
  args.log.debug("tese conferida", { repeats: verdict.repeats });
  return verdict;
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
): Promise<number> {
  await recordChatUsage({
    sessionId,
    route,
    model,
    promptTokens: data.usage.promptTokens,
    completionTokens: data.usage.completionTokens,
    cachedTokens: data.usage.cachedTokens,
    latencyMs: data.latencyMs,
  });
  return data.usage.totalTokens ?? 0;
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
