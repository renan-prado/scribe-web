import "server-only";
import { BIBLO_SYSTEM_PROMPT, bibloContextBlock } from "@/features/session/server/prompts/biblo";
import { anchorReference } from "@/features/session/server/study/anchor";
import type { BibloRow } from "@/lib/db/biblo";
import { type BibloReply, BibloReplySchema, type BibloSuggestion } from "@/lib/domain/biblo";
import type { SummaryBlock, SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { type ChatMessage, type ChatResult, callChat, type Result } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";

const log = createLogger("biblo");

/**
 * O motor de uma mensagem: monta o prompt, chama o modelo, valida a resposta e
 * resolve as referências bíblicas contra a NVI local.
 *
 * As duas constantes abaixo são AMARRAS DE MARGEM, não ajustes de gosto. O
 * preço de `COIN_COSTS.bibloMessage` foi calculado com as duas no lugar; sem
 * elas o custo de uma mensagem não tem teto superior nenhum — cresce com o
 * tamanho do resumo na entrada e com o tamanho da resposta na saída — e a
 * conta que justifica o preço deixa de valer. Ver `features/coins/pricing.ts`.
 */

/**
 * Teto da resposta. Uma resposta de chat que passa disso é pior de ler E dobra
 * a parcela mais cara da conta (token de saída). O prompt já pede resposta
 * curta; isto é a mesma regra escrita onde ela é obrigatória em vez de pedida.
 */
export const BIBLO_ANSWER_MAX_TOKENS = 400;

/**
 * Teto do resumo que entra no prompt, em CARACTERES (~4 por token em
 * português). Quase todo resumo cabe folgado; o que não couber entra truncado
 * pelo fim — o começo de um resumo (título, ideia central, primeiros blocos) é
 * o que mais diz sobre o que se está conversando.
 */
export const BIBLO_SUMMARY_CHAR_BUDGET = 10_000;

/**
 * A janela: quantos PARES de mensagens vão ao modelo.
 *
 * É o que mantém o custo por mensagem CONSTANTE. Sem ela, cada resposta releria
 * a conversa inteira e a vigésima mensagem custaria quatro vezes a primeira —
 * um preço fixo por mensagem estaria errado justamente na conversa longa, que
 * é a boa. O que fica fora da janela não some: vira o `thread`, o fio que a
 * própria chamada reescreve a cada resposta, de graça.
 */
export const BIBLO_WINDOW_PAIRS = 6;

/**
 * Rede de segurança para um marcador `[[Jonas 1:3]]` perdido.
 *
 * O prompt PEDIU essa sintaxe numa versão e o modelo não a usou: medido, o
 * `gpt-4.1-mini` escreve a referência em prosa ("em Lucas 15 Jesus conta…"),
 * que é o que a gente queria de qualquer jeito — o `RichText` da gaveta já
 * transforma referência em prosa num link para a NVI, igual ao resumo e ao
 * estudo. O prompt passou a pedir a prosa, e isto aqui ficou: se um marcador
 * escapar, ele vira a referência limpa em vez de aparecer com colchetes na
 * cara de quem lê.
 */
const MARKER_RE = /\[\[([^\]]{1,80})\]\]/g;

export type BibloAnswerInput = {
  userId: string;
  sessionId: string;
  summary: SummaryPayload | null;
  speakerName: string | null;
  /** A conversa inteira, em ordem. A janela é recortada aqui dentro. */
  history: BibloRow[];
  question: string;
};

export type BibloAnswerOk = {
  reply: BibloReply;
  model: string;
  usage: ChatResult["usage"];
  latencyMs: number;
};

export type BibloAnswerResult =
  | { ok: true; data: BibloAnswerOk }
  | { ok: false; kind: "upstream" | "unparseable"; message: string };

/**
 * Os blocos do resumo, numerados, cortados no orçamento.
 *
 * O índice é o que `suggestion.afterIndex` aponta, e é por isso que ele vai
 * escrito: um modelo que não vê o número chuta a posição, e a sugestão entra no
 * meio do texto errado.
 */
function renderBlocks(blocks: SummaryBlock[]): string[] {
  const lines: string[] = [];
  let used = 0;
  for (const [index, block] of blocks.entries()) {
    const body =
      block.type === "bibleQuote"
        ? `${block.reference}${block.text ? ` — ${block.text}` : ""}`
        : block.type === "quote" && block.author
          ? `${block.text} — ${block.author}`
          : block.text;
    const line = `[${index}] ${block.type}: ${body}`;
    if (used + line.length > BIBLO_SUMMARY_CHAR_BUDGET) {
      lines.push(`[…] (o resumo continua, mais ${blocks.length - index} blocos)`);
      break;
    }
    lines.push(line);
    used += line.length;
  }
  return lines;
}

/** O fio mais recente: o último que o assistente escreveu. */
function latestThread(history: BibloRow[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const thread = history[i].thread;
    if (thread) return thread;
  }
  return "";
}

function windowMessages(history: BibloRow[]): ChatMessage[] {
  const window = history.slice(-BIBLO_WINDOW_PAIRS * 2);
  return window.map((row) => ({
    role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: row.content,
  }));
}

/**
 * Troca `[[Jonas 1:1-3]]` pela referência limpa, e APAGA a que não resolve.
 *
 * O texto do versículo nunca entra aqui: quem o desenha é o `RichText` da
 * gaveta, que reconhece a referência em prosa e abre a NVI local no clique — o
 * mesmo caminho do resumo e do estudo. Ou seja, **em nenhum ponto o modelo tem
 * a caneta do texto bíblico**, que é a única forma de um versículo inventado
 * ser impossível em vez de improvável.
 */
async function resolveMarkers(text: string): Promise<{ text: string; dropped: number }> {
  const raw = [...text.matchAll(MARKER_RE)].map((m) => m[1].trim());
  if (raw.length === 0) return { text, dropped: 0 };

  const unique = [...new Set(raw)];
  const resolved = new Map<string, string | null>();
  await Promise.all(
    unique.map(async (ref) => {
      const anchored = await anchorReference(ref).catch(() => null);
      resolved.set(ref, anchored?.reference ?? null);
    })
  );

  let dropped = 0;
  const next = text.replace(MARKER_RE, (_match, inner: string) => {
    const hit = resolved.get(inner.trim());
    if (hit) return hit;
    dropped++;
    return "";
  });
  // Um marcador apagado deixa espaço duplo e " ." para trás.
  return {
    text: next
      .replace(/ {2,}/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim(),
    dropped,
  };
}

/**
 * A sugestão, conferida.
 *
 * Duas coisas acontecem aqui, e a primeira é a que importa: quando o bloco é
 * `bibleQuote`, o `text` é escrito pelo SERVIDOR a partir da NVI, e a sugestão
 * inteira é descartada se a referência não resolver. O modelo só escolhe QUAL
 * passagem; ele nunca escreve o que ela diz.
 */
async function verifySuggestion(
  suggestion: BibloSuggestion | null,
  blockCount: number
): Promise<BibloSuggestion | null> {
  if (!suggestion) return null;

  let block = suggestion.block;
  if (block.type === "bibleQuote") {
    const anchored = await anchorReference(block.reference).catch(() => null);
    if (!anchored) return null;
    block = { type: "bibleQuote", reference: anchored.reference, text: anchored.text };
  }

  // O modelo chuta índices fora da lista de vez em quando; um `afterIndex` de
  // 12 num resumo de 5 blocos inseriria no fim sem ninguém pedir. Clampear é a
  // leitura mais próxima da intenção.
  const afterIndex = Math.min(Math.max(suggestion.afterIndex, -1), blockCount - 1);
  return { label: suggestion.label, block, afterIndex };
}

export async function generateBibloAnswer(input: BibloAnswerInput): Promise<BibloAnswerResult> {
  const summary = input.summary;
  const blocks = summary?.blocks ?? [];

  const context = bibloContextBlock({
    title: summary?.title ?? "",
    shortSummary: summary?.shortSummary ?? "",
    speakerName: input.speakerName,
    blocks: renderBlocks(blocks),
    thread: latestThread(input.history),
  });

  // A ordem é deliberada: instruções e contexto PRIMEIRO, e os dois estáveis
  // durante a conversa inteira. É esse prefixo que o cache automático da OpenAI
  // pega (25% do preço na família 4.1), e é a diferença entre 74% e 61% de
  // margem em `features/coins/pricing.ts`. Qualquer coisa variável antes deles
  // invalida o cache a cada mensagem, sem erro nenhum na tela.
  const messages: ChatMessage[] = [
    { role: "system", content: BIBLO_SYSTEM_PROMPT },
    { role: "system", content: context },
    ...windowMessages(input.history),
    { role: "user", content: input.question },
  ];

  const model = serverEnv.OPENAI_BIBLO_MODEL;
  const result: Result<ChatResult> = await callChat({
    model,
    messages,
    temperature: 0.7,
    maxTokens: BIBLO_ANSWER_MAX_TOKENS,
    responseFormat: { type: "json_object" },
    store: true,
    metadata: buildLlmMetadata({
      route: "biblo",
      userId: input.userId,
      sessionId: input.sessionId,
    }),
  });

  if (!result.ok) {
    const message =
      result.error.kind === "http"
        ? `${result.error.status}: ${result.error.snippet}`
        : result.error.message;
    return { ok: false, kind: "upstream", message };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.content);
  } catch {
    return { ok: false, kind: "unparseable", message: "resposta não é JSON" };
  }

  const reply = BibloReplySchema.safeParse(parsed);
  if (!reply.success) {
    log.warn("schema-drop", { issues: reply.error.issues.length });
    return { ok: false, kind: "unparseable", message: "resposta fora do contrato" };
  }

  const [answer, suggestion] = await Promise.all([
    resolveMarkers(reply.data.answer),
    verifySuggestion(reply.data.suggestion, blocks.length),
  ]);

  if (answer.dropped > 0) {
    // Não é erro de usuário nem motivo para 500: a resposta segue sem a
    // referência que não existe. Mas é sinal de prompt, e ele precisa aparecer.
    log.warn("referência inválida descartada", { dropped: answer.dropped, model });
  }

  return {
    ok: true,
    data: {
      reply: { ...reply.data, answer: answer.text, suggestion },
      model,
      usage: result.data.usage,
      latencyMs: result.data.latencyMs,
    },
  };
}
