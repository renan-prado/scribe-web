import { NextResponse } from "next/server";
import { requireBalance } from "@/lib/coins/require-balance";
import { recordChatUsage } from "@/lib/db/usage";
import {
  coerceFeedItemsLoose,
  type FeedItem,
  feedItemDedupKey,
  parseInsightsFromLLM,
} from "@/lib/domain/feed";
import { serverEnv } from "@/lib/env/server";
import { LivePipelineBodySchema, parseJsonBody } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { INSIGHTS_SYSTEM_PROMPT } from "@/lib/prompts/insights";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("insights");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live "insights" pipeline: emite os 5 kinds que não são citedVerse
 * (speakerHighlight, speakerCitation, relatedVerse, context, suggestedQuote).
 * Roda em cadência lenta (~45s) pra baratear tokens e dar contexto acumulado
 * ao modelo. citedVerse fica com /api/bible.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.insights, auth.user.id);
  if (limited) return limited;

  const broke = requireBalance(auth.user);
  if (broke) return broke;

  const model = serverEnv.OPENAI_INSIGHTS_MODEL;

  const parsed = await parseJsonBody(request, LivePipelineBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const text = (body.text ?? "").trim();
  const sermonAt = formatSermonAt(body.sermonAtMs);
  if (!text) {
    return NextResponse.json({ items: [] });
  }

  const existingItems = coerceFeedItemsLoose(body.existingItems);
  const existingKeys = new Set(existingItems.map(feedItemDedupKey));
  const existingSummary = summarizeExistingForPrompt(existingItems);

  const userMessage = `existingItems:\n${JSON.stringify(existingSummary)}\n\n---\ntranscript:\n${text}`;

  const sessionId = body.sessionId ?? null;
  const result = await callChat({
    model,
    temperature: 0.3,
    maxTokens: 800,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "insights", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      log.error("upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, items: [] },
        { status: 502 }
      );
    }
    log.error("upstream error", {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs, items: [] },
      { status: 502 }
    );
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const { items, drops } = parseInsightsFromLLM(content, existingKeys);
  for (const d of drops) {
    if (d.reason === "dedup") continue;
    log.warn("schema-drop", d);
  }
  log.debug("ok", {
    sermonAt,
    model,
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    items: items.length,
    kinds: items.map((i) => i.kind),
    drops: drops.length,
  });
  await recordChatUsage({
    userId: auth.user.id,
    sessionId,
    route: "insights",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });
  return NextResponse.json({ items, latencyMs, model });
}

function formatSermonAt(ms: number | undefined): string {
  if (!ms || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Limita histórico de itens da IA. citedVerses fica completo pra relatedVerse
 * dedup cobrir toda a sessão; speaker/AI items ficam janelados porque o
 * modelo raramente revisita temas antigos na janela atual.
 */
const RECENT_DEDUP_WINDOW = 12;

function summarizeExistingForPrompt(items: FeedItem[]) {
  const citedVerses: string[] = [];
  const speakerHighlights: string[] = [];
  const speakerCitations: Array<{ author: string; text: string }> = [];
  const relatedVerses: string[] = [];
  const contexts: Array<{ label: string; text: string }> = [];
  const suggestedQuotes: Array<{ author: string; text: string }> = [];
  for (const it of items) {
    if (it.kind === "citedVerse") citedVerses.push(it.reference);
    else if (it.kind === "speakerHighlight") speakerHighlights.push(it.text);
    else if (it.kind === "speakerCitation")
      speakerCitations.push({ author: it.author, text: it.text });
    else if (it.kind === "relatedVerse") relatedVerses.push(it.reference);
    else if (it.kind === "context") contexts.push({ label: it.label, text: it.text });
    else if (it.kind === "suggestedQuote")
      suggestedQuotes.push({ author: it.author, text: it.text });
  }
  return {
    citedVerses,
    speakerHighlights: speakerHighlights.slice(-RECENT_DEDUP_WINDOW),
    speakerCitations: speakerCitations.slice(-RECENT_DEDUP_WINDOW),
    relatedVerses: relatedVerses.slice(-RECENT_DEDUP_WINDOW),
    contexts: contexts.slice(-RECENT_DEDUP_WINDOW),
    suggestedQuotes: suggestedQuotes.slice(-RECENT_DEDUP_WINDOW),
  };
}
