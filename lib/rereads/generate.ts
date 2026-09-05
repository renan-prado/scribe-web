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
 */

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
  const truncatedPool = pool.slice(0, target);
  const needed = target - truncatedPool.length;

  log.debug(`pool`, {
    total: pool.length,
    kept: truncatedPool.length,
    needed,
    byOrigin: countByOrigin(truncatedPool),
  });

  if (needed === 0) {
    const payload = await enrichWithVerseText(assembleFinal(truncatedPool, []), logPrefix);
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
    `needed: ${needed}`,
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

  const dedupedFill = dedupeFillAgainstPool(fillItems, truncatedPool).slice(0, needed);
  const payload = await enrichWithVerseText(assembleFinal(truncatedPool, dedupedFill), logPrefix);

  if (!isCompleteRereadsPayload(payload)) {
    log.warn(`incomplete payload — expected 10 items covering all offsets`, {
      got: payload.items.length,
      offsets: payload.items.map((i) => i.dayOffset),
    });
    return { ok: false, kind: "incomplete", payload, latencyMs };
  }

  return { ok: true, payload, latencyMs, model, fillCount: dedupedFill.length };
}

type FillItemNormalized = { reference: string };

function dedupeFillAgainstPool(
  fill: { reference: string }[],
  pool: RereadPoolItem[]
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

function assembleFinal(pool: RereadPoolItem[], fill: FillItemNormalized[]): RereadsPayload {
  const items: RereadItem[] = [];
  const offsets = REREAD_DAY_OFFSETS as readonly RereadDayOffset[];
  let cursor = 0;
  // Primeiro os do pool (que já vêm intercalados por origem em collect.ts)
  // ocupam os offsets ascendentes.
  for (const p of pool) {
    if (cursor >= offsets.length) break;
    items.push({
      dayOffset: offsets[cursor],
      reference: p.reference,
      text: p.text,
      reason: p.reason,
      origin: p.origin,
    });
    cursor++;
  }
  // Depois o fill preenche o restante.
  for (const f of fill) {
    if (cursor >= offsets.length) break;
    items.push({
      dayOffset: offsets[cursor],
      reference: f.reference,
      text: "",
      reason: "",
      origin: "ai-fill",
    });
    cursor++;
  }
  return { items };
}

function countByOrigin(pool: RereadPoolItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of pool) {
    out[p.origin] = (out[p.origin] ?? 0) + 1;
  }
  return out;
}

/**
 * Preenche `text` de cada item que ainda está sem (`related`, `summary` sem
 * texto, ou `ai-fill`) buscando na Bíblia NVI local. Referências sem verso
 * específico ou que não batem no arquivo NVI ficam com string vazia — a UI
 * simplesmente esconde o bloco do versículo nesses casos.
 */
async function enrichWithVerseText(
  payload: RereadsPayload,
  logPrefix: string
): Promise<RereadsPayload> {
  const log = createLogger(logPrefix);
  const missing = payload.items.filter((i) => !i.text.trim());
  if (missing.length === 0) return payload;

  const bible = await loadBible();
  if (!bible) {
    log.warn(`bible not loaded for text enrichment`, {
      translation: BIBLE_TRANSLATION,
    });
    return payload;
  }

  let filled = 0;
  const items = payload.items.map((item) => {
    if (item.text.trim()) return item;
    const parsed = parseVerseReference(item.reference);
    if (!parsed || parsed.startVerse == null || parsed.endVerse == null) return item;
    const { text } = lookupVerse(
      bible,
      parsed.bookDisplay,
      parsed.chapter,
      parsed.startVerse,
      parsed.endVerse
    );
    if (!text) return item;
    filled++;
    return { ...item, text };
  });

  log.debug(`enriched`, { missing: missing.length, filled });
  return { items };
}
