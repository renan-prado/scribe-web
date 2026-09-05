import "server-only";
import { BIBLE_TRANSLATION, loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { recordChatUsage, type UsageRoute } from "@/lib/db/usage";
import type { FeedItem } from "@/lib/domain/feed";
import { parseVerseReference, referenceStrictlyContains } from "@/lib/domain/feed";
import {
  isCompleteRereadsPayload,
  parseRereadsFillFromLLM,
  REREAD_DAY_OFFSETS,
  type RereadDayOffset,
  type RereadItem,
  type RereadOrigin,
  type RereadsPayload,
} from "@/lib/domain/rereads";
import type { SummaryPayload } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { REREADS_FILL_SYSTEM_PROMPT } from "@/lib/prompts/rereads";
import { collectRereadPool, type RereadPoolItem, referencesFromPool } from "@/lib/rereads/collect";

/**
 * Gera 10 sugestões de "Releia este texto" para uma sessão. Reaproveita:
 *   - citedVerse do feed live (o pastor leu)
 *   - relatedVerse do feed live (IA sugeriu junto)
 *   - bibleQuote / relatedVerse do final_summary
 *
 * Só chama o LLM se o pool reaproveitado não cobrir os 10 slots. Um payload
 * incompleto (menos de 10 offsets) é tratado como falha para não persistir
 * estado ruim — a UI espera sempre os 10.
 *
 * Falha aqui NÃO deve derrubar a resposta do resumo — o chamador loga e segue.
 *
 * ## O texto é resolvido ANTES de o item ganhar um slot
 *
 * `withVerseText` roda sobre os CANDIDATOS, não sobre o payload montado, e
 * descarta quem não tem o que reler. A ordem inversa — montar os dez e buscar
 * o texto depois — foi o que colocou um card "Judas", sem capítulo e sem
 * versículo, no feed de um usuário: o item já tinha ocupado o slot quando a
 * busca falhou, e não havia mais como devolvê-lo. Resolver antes custa a mesma
 * ida à NVI (que é um objeto em memória) e transforma "card vazio" em "outro
 * candidato entra no lugar".
 */

/**
 * Um candidato a slot, antes de ganhar um `dayOffset`. É o `RereadPoolItem` do
 * `collect.ts` aberto para também acomodar o `ai-fill`, que nasce da chamada de
 * preenchimento e não do pool — daí os dois passarem pelo mesmo
 * `withVerseText` e pelo mesmo `assembleFinal`.
 */
type RereadCandidate = Omit<RereadPoolItem, "origin"> & { origin: RereadOrigin };

export type GenerateRereadsSuccess = {
  ok: true;
  payload: RereadsPayload;
  latencyMs: number;
  model: string | null;
  fillCount: number;
};

export type GenerateRereadsError =
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "upstream"; message: string; status: number; latencyMs: number }
  | { ok: false; kind: "incomplete"; payload: RereadsPayload; latencyMs: number };

export type GenerateRereadsResult = GenerateRereadsSuccess | GenerateRereadsError;

export type GenerateRereadsInput = {
  userId: string;
  sessionId: string;
  transcript: string;
  finalSummary: SummaryPayload;
  feedItems: FeedItem[];
  logPrefix: string;
  /** Rota gravada na telemetria: "rereads" na primeira geração,
   * "rereads-reprocess" quando quem chamou foi o reprocessamento. */
  metadataRoute: Extract<UsageRoute, "rereads" | "rereads-reprocess">;
};

export async function generateRereads(input: GenerateRereadsInput): Promise<GenerateRereadsResult> {
  const { userId, sessionId, transcript, finalSummary, feedItems, logPrefix, metadataRoute } =
    input;
  const log = createLogger(logPrefix);
  const target = REREAD_DAY_OFFSETS.length;

  const pool = collectRereadPool(feedItems, finalSummary);
  const usablePool = await withVerseText(pool, logPrefix);
  const truncatedPool = usablePool.slice(0, target);
  const needed = target - truncatedPool.length;

  log.debug(`pool`, {
    total: pool.length,
    usable: usablePool.length,
    kept: truncatedPool.length,
    needed,
    byOrigin: countByOrigin(truncatedPool),
  });

  if (needed === 0) {
    const payload = assembleFinal(truncatedPool, []);
    if (!isCompleteRereadsPayload(payload)) {
      log.warn(`incomplete payload assembly`, {
        got: payload.items.length,
      });
      return { ok: false, kind: "incomplete", payload, latencyMs: 0 };
    }
    return { ok: true, payload, latencyMs: 0, model: null, fillCount: 0 };
  }

  const model = serverEnv.OPENAI_REREADS_MODEL;
  const existingRefs = referencesFromPool(truncatedPool);
  const userMessage = [
    // Pedimos FOLGA de propósito. Toda sugestão ainda passa pela NVI, e a que
    // não resolve é descartada — sem a folga, uma única referência torta do
    // modelo deixa o payload com nove itens, e nove reprova em
    // `isCompleteRereadsPayload`: o usuário fica sem releitura nenhuma por
    // causa de uma. O excedente é cortado logo abaixo e não é persistido.
    `needed: ${needed + FILL_SLACK}`,
    `existingReferences:\n${JSON.stringify(existingRefs)}`,
    `finalSummary:\n${JSON.stringify(finalSummary)}`,
    `transcript:\n${transcript}`,
  ].join("\n\n---\n");

  const result = await callChat({
    model,
    // O prompt já tá bem restritivo, uma temperatura média dá espaço para
    // pescar textos que não sejam os óbvios da tese, sem soltar demais.
    temperature: 0.6,
    maxTokens: 1200,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: REREADS_FILL_SYSTEM_PROMPT },
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
  const fillItems = parseRereadsFillFromLLM(content);

  log.debug(`ok`, {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    needed,
    got: fillItems.length,
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

  const deduped = dedupeFillAgainstPool(fillItems, truncatedPool);
  const dedupedFill = (
    await withVerseText(
      deduped.map((f) => ({ reference: f.reference, text: "", reason: "", origin: "ai-fill" })),
      logPrefix
    )
  ).slice(0, needed);
  const payload = assembleFinal(truncatedPool, dedupedFill);

  if (!isCompleteRereadsPayload(payload)) {
    log.warn(`incomplete payload — expected 10 items covering all offsets`, {
      got: payload.items.length,
      offsets: payload.items.map((i) => i.dayOffset),
    });
    return { ok: false, kind: "incomplete", payload, latencyMs };
  }

  return { ok: true, payload, latencyMs, model, fillCount: dedupedFill.length };
}

/**
 * Quantas referências a mais pedimos ao modelo além do `needed` real. Duas
 * bastam: a taxa de referência que não resolve na NVI é baixa, e cada extra é
 * token pago. Ver o comentário no `userMessage`.
 */
const FILL_SLACK = 2;

type FillItemNormalized = { reference: string };

function dedupeFillAgainstPool(
  fill: { reference: string }[],
  pool: RereadCandidate[]
): FillItemNormalized[] {
  const kept: FillItemNormalized[] = [];
  for (const item of fill) {
    const ref = item.reference.trim();
    if (!ref) continue;
    const parsed = parseVerseReference(ref);
    if (!parsed) continue;
    // Rejeita se coincide com pool (exato, ou sub-passagem contida).
    const clashesWithPool = pool.some(
      (p) =>
        normalizeRef(p.reference) === normalizeRef(ref) ||
        referenceStrictlyContains(p.reference, ref) ||
        referenceStrictlyContains(ref, p.reference)
    );
    if (clashesWithPool) continue;
    // Rejeita duplicata dentro do próprio fill.
    const clashesInFill = kept.some(
      (k) =>
        normalizeRef(k.reference) === normalizeRef(ref) ||
        referenceStrictlyContains(k.reference, ref) ||
        referenceStrictlyContains(ref, k.reference)
    );
    if (clashesInFill) continue;
    kept.push({ reference: ref });
  }
  return kept;
}

function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

function assembleFinal(pool: RereadCandidate[], fill: RereadCandidate[]): RereadsPayload {
  const items: RereadItem[] = [];
  const offsets = REREAD_DAY_OFFSETS as readonly RereadDayOffset[];
  let cursor = 0;
  // Primeiro os do pool (que já vêm intercalados por origem em collect.ts)
  // ocupam os offsets ascendentes; depois o fill preenche o restante. Os dois
  // já passaram por `withVerseText`, então todo item aqui tem texto.
  for (const candidate of [...pool, ...fill]) {
    if (cursor >= offsets.length) break;
    items.push({
      dayOffset: offsets[cursor],
      reference: candidate.reference,
      text: candidate.text,
      reason: candidate.reason,
      origin: candidate.origin,
    });
    cursor++;
  }
  return { items };
}

function countByOrigin(pool: RereadCandidate[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of pool) {
    out[p.origin] = (out[p.origin] ?? 0) + 1;
  }
  return out;
}

/**
 * Resolve o texto de cada candidato e DESCARTA quem fica sem.
 *
 * Um candidato sobrevive de dois jeitos: já veio com texto (o pregador leu, ou
 * o bloco do resumo trouxe a citação), ou a referência aponta versículo e a NVI
 * responde. Quem não se encaixa em nenhum dos dois — referência de capítulo
 * inteiro, faixa que passa do fim do capítulo, livro sem número — não tem o que
 * ser relido, e um card de releitura sem texto para reler é pior que um slot a
 * menos.
 *
 * NVI indisponível derruba tudo que dependia dela, e é o comportamento certo:
 * a alternativa seria persistir dez cards vazios.
 */
async function withVerseText(
  candidates: RereadCandidate[],
  logPrefix: string
): Promise<RereadCandidate[]> {
  const log = createLogger(logPrefix);
  const withOwnText = candidates.filter((c) => c.text.trim());
  const needLookup = candidates.filter((c) => !c.text.trim());
  if (needLookup.length === 0) return candidates;

  const bible = await loadBible();
  if (!bible) {
    log.warn(`bible not loaded — dropping candidates without text`, {
      translation: BIBLE_TRANSLATION,
      dropped: needLookup.length,
    });
    return withOwnText;
  }

  let filled = 0;
  let dropped = 0;
  const out: RereadCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.text.trim()) {
      out.push(candidate);
      continue;
    }
    const parsed = parseVerseReference(candidate.reference);
    if (!parsed || parsed.startVerse == null || parsed.endVerse == null) {
      dropped++;
      continue;
    }
    const { text } = lookupVerse(
      bible,
      parsed.bookDisplay,
      parsed.chapter,
      parsed.startVerse,
      parsed.endVerse
    );
    if (!text) {
      dropped++;
      continue;
    }
    filled++;
    out.push({ ...candidate, text });
  }

  log.debug(`verse text`, { missing: needLookup.length, filled, dropped });
  return out;
}
