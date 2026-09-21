import "server-only";
import { BIBLE_SEARCH_SYSTEM_PROMPT } from "@/features/session/server/prompts/bible-search";
import { abbrevFor } from "@/lib/bibles/books";
import { CHAPTER_VERSE_COUNTS } from "@/lib/bibles/chapter-lengths";
import { loadBible } from "@/lib/bibles/loader";
import { lookupPassage } from "@/lib/bibles/lookup";
import {
  type BibleAISearchResponse,
  type BibleSearchPassage,
  parseBibleAISearchFromLLM,
} from "@/lib/domain/bible-search";
import { parseVerseReference } from "@/lib/domain/reference";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { type ChatResult, callChat, type Result } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";

const log = createLogger("bible-search");

/**
 * A busca por SENTIDO: uma pergunta em linguagem natural vira uma lista de
 * passagens de verdade. Ver o cabeçalho de `lib/domain/bible-search.ts` para
 * o porquê do contrato, e de `prompts/bible-search.ts` para o do prompt.
 *
 * ## ANCORAGEM sem LLM, a mesma técnica do estudo
 *
 * O modelo escreve só a referência e uma nota; quem resolve o texto real é
 * este arquivo, contra a NVI local (`lookupPassage`), o MESMO mecanismo de
 * `server/study/anchor.ts` — a diferença é que ali o resultado é um texto
 * corrido (pensado para entrar num parágrafo do estudo) e aqui a tela
 * precisa dos versículos SEPARADOS, para numerar cada um e para o "Ir para a
 * passagem" saber em qual rolar e destacar. Por isso a resolução mora aqui,
 * em vez de uma chamada a `anchorReference`.
 *
 * **Referência que não resolve é DESCARTADA, em silêncio.** Nenhum aviso de
 * "uma referência não encontrada" chega à tela: são no máximo seis por
 * resposta, o modelo alucina raramente, e o que sobra (as que resolveram) já
 * é a resposta completa do ponto de vista de quem perguntou.
 */

const MAX_OUTPUT_TOKENS = 500;

type ResolvedReference = {
  reference: string;
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
};

/** Resolve UMA referência contra a NVI local. `null` quando livro, capítulo
 * ou versículo não existem — a mesma checagem de `anchorReference`, mas
 * devolvendo os versículos SEPARADOS em vez de um texto corrido. */
async function resolveReference(raw: string): Promise<ResolvedReference | null> {
  const parsed = parseVerseReference(raw);
  if (!parsed) return null;

  const abbrev = abbrevFor(parsed.bookDisplay);
  if (!abbrev) return null;

  const chapterLength = CHAPTER_VERSE_COUNTS[abbrev]?.[parsed.chapter - 1];
  if (!chapterLength) return null;

  const start = parsed.startVerse ?? 1;
  if (start < 1 || start > chapterLength) return null;
  const end = Math.min(parsed.endVerse ?? parsed.startVerse ?? chapterLength, chapterLength);

  const bible = await loadBible();
  if (!bible) return null;

  const verses = lookupPassage(bible, parsed.bookDisplay, parsed.chapter, start, end);
  if (verses.length === 0) return null;

  const reference =
    start === end
      ? `${parsed.bookDisplay} ${parsed.chapter}:${start}`
      : `${parsed.bookDisplay} ${parsed.chapter}:${start}-${end}`;

  return { reference, book: parsed.bookDisplay, chapter: parsed.chapter, verses };
}

export type BibleSearchFailure = { kind: "upstream"; message: string } | { kind: "no_content" };

export type BibleSearchResult =
  | {
      ok: true;
      data: BibleAISearchResponse;
      /** Para `recordChatUsage`, chamado pela ROTA — mesma divisão de
       * responsabilidade do `biblo/answer.ts`. */
      model: string;
      usage: ChatResult["usage"];
      latencyMs: number;
    }
  | { ok: false; error: BibleSearchFailure };

export async function searchBibleBySense(input: {
  question: string;
  userId: string;
}): Promise<BibleSearchResult> {
  const model = serverEnv.OPENAI_BIBLE_MODEL;
  const result: Result<ChatResult> = await callChat({
    model,
    messages: [
      { role: "system", content: BIBLE_SEARCH_SYSTEM_PROMPT },
      { role: "user", content: input.question },
    ],
    temperature: 0.4,
    maxTokens: MAX_OUTPUT_TOKENS,
    responseFormat: { type: "json_object" },
    store: true,
    metadata: buildLlmMetadata({ route: "bible-search", userId: input.userId }),
  });

  if (!result.ok) {
    const message =
      result.error.kind === "http"
        ? `${result.error.status}: ${result.error.snippet}`
        : result.error.message;
    return { ok: false, error: { kind: "upstream", message } };
  }

  const reply = parseBibleAISearchFromLLM(result.data.content);
  if (!reply || (!reply.explanation.trim() && reply.passages.length === 0)) {
    // A régua de sempre: nenhum campo derruba uma resposta já paga, exceto a
    // ausência total do que mostrar — aqui, nem explicação nem passagem.
    return { ok: false, error: { kind: "no_content" } };
  }

  const resolved = await Promise.all(reply.passages.map((hit) => resolveReference(hit.reference)));
  const passages: BibleSearchPassage[] = [];
  for (let i = 0; i < resolved.length; i++) {
    const anchor = resolved[i];
    if (!anchor) continue;
    passages.push({
      reference: anchor.reference,
      book: anchor.book,
      chapter: anchor.chapter,
      verses: anchor.verses.map((v) => ({ verse: v.verse, text: v.text })),
      note: reply.passages[i].note,
    });
  }

  log.debug("ok", {
    model,
    latencyMs: result.data.latencyMs,
    finishReason: result.data.finishReason,
    promptTokens: result.data.usage.promptTokens,
    completionTokens: result.data.usage.completionTokens,
    hits: reply.passages.length,
    resolved: passages.length,
  });

  return {
    ok: true,
    data: { explanation: reply.explanation, passages },
    model,
    usage: result.data.usage,
    latencyMs: result.data.latencyMs,
  };
}
