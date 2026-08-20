import { NextResponse } from "next/server";
import { type FeedItem, feedItemDedupKey, parseSuggestFromLLM } from "@/lib/domain/feed";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { SUGGEST_SYSTEM_PROMPT } from "@/lib/prompts/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live "suggest" pipeline: generates AI-authored enrichment (related verses,
 * historical/linguistic context, quotes from other authors) that the speaker
 * did NOT mention. Runs on a slower cadence than /api/extract so the model
 * has more accumulated context before deciding what actually deserves a card.
 */
export async function POST(request: Request) {
  const model = serverEnv.OPENAI_SUGGEST_MODEL;

  let body: { text?: string; existingItems?: FeedItem[]; sermonAtMs?: number };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const text = (body.text ?? "").trim();
  const sermonAt = formatSermonAt(body.sermonAtMs);
  if (!text) {
    return NextResponse.json({ items: [] });
  }

  const existingItems = Array.isArray(body.existingItems) ? body.existingItems : [];
  const existingKeys = new Set(existingItems.map(feedItemDedupKey));
  const existingSummary = summarizeExistingForPrompt(existingItems);

  const userMessage = `existingItems:\n${JSON.stringify(existingSummary)}\n\n---\ntranscript:\n${text}`;

  const result = await callChat({
    model,
    temperature: 0.3,
    maxTokens: 1500,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: SUGGEST_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[suggest] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, items: [] },
        { status: 502 }
      );
    }
    console.error("[suggest] upstream error", {
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
  const { items, drops } = parseSuggestFromLLM(content, existingKeys);
  for (const d of drops) {
    if (d.reason === "dedup") continue;
    console.warn("[suggest] schema-drop", d);
  }
  console.log("[suggest] ok", {
    sermonAt,
    model,
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    items: items.length,
    kinds: items.map((i) => i.kind),
    drops: drops.length,
    inputTail: text.slice(-400),
    rawOutput: content.slice(0, 800),
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
 * Cap AI-generated history to the most recent N entries per type. citedVerses
 * stay full so relatedVerse dedup covers the whole session; AI items are
 * windowed since the model's current window rarely revisits older themes.
 */
const RECENT_DEDUP_WINDOW = 10;

function summarizeExistingForPrompt(items: FeedItem[]) {
  const citedVerses: string[] = [];
  const speakerCitations: Array<{ author: string; text: string }> = [];
  const relatedVerses: string[] = [];
  const contexts: Array<{ label: string; text: string }> = [];
  const suggestedQuotes: Array<{ author: string; text: string }> = [];
  for (const it of items) {
    if (it.kind === "citedVerse") citedVerses.push(it.reference);
    else if (it.kind === "speakerCitation")
      speakerCitations.push({ author: it.author, text: it.text });
    else if (it.kind === "relatedVerse") relatedVerses.push(it.reference);
    else if (it.kind === "context") contexts.push({ label: it.label, text: it.text });
    else if (it.kind === "suggestedQuote")
      suggestedQuotes.push({ author: it.author, text: it.text });
  }
  return {
    citedVerses,
    speakerCitations: speakerCitations.slice(-RECENT_DEDUP_WINDOW),
    relatedVerses: relatedVerses.slice(-RECENT_DEDUP_WINDOW),
    contexts: contexts.slice(-RECENT_DEDUP_WINDOW),
    suggestedQuotes: suggestedQuotes.slice(-RECENT_DEDUP_WINDOW),
  };
}
