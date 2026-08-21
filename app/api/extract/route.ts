import { NextResponse } from "next/server";
import { recordChatUsage } from "@/lib/db/usage";
import { type FeedItem, feedItemDedupKey, parseExtractFromLLM } from "@/lib/domain/feed";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/extract";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live "extract" pipeline: pulls out only what the speaker actually said —
 * cited verses, verbatim highlight phrases, and third-party citations the
 * speaker attributed on the fly. Runs on every chunk during a recording. The
 * companion /api/suggest pipeline handles AI-generated enrichment.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const model = serverEnv.OPENAI_EXTRACT_MODEL;

  let body: {
    text?: string;
    existingItems?: FeedItem[];
    sermonAtMs?: number;
    sessionId?: string;
  };
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

  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null;
  const result = await callChat({
    model,
    temperature: 0.3,
    maxTokens: 800,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "extract", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[extract] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, items: [] },
        { status: 502 }
      );
    }
    console.error("[extract] upstream error", {
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
  const { items, thinking, readingMode, translationHint, drops } = parseExtractFromLLM(
    content,
    existingKeys
  );
  for (const d of drops) {
    if (d.reason === "dedup") continue;
    console.warn("[extract] schema-drop", d);
  }
  console.log("[extract] ok", {
    sermonAt,
    model,
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    items: items.length,
    kinds: items.map((i) => i.kind),
    readingMode,
    translationHint,
    drops: drops.length,
    thinking: thinking.slice(0, 120),
  });
  await recordChatUsage({
    sessionId,
    route: "extract",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    latencyMs,
  });
  return NextResponse.json({ items, thinking, readingMode, translationHint, latencyMs, model });
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
 * Compact the existing feed into just what the extract prompt needs to dedup.
 * All three kinds are windowed to the most recent N: the LLM's window is
 * "what the speaker is talking about now", so a verse dropped 20 minutes
 * ago is unlikely to come up again — and if it does, client-side dedup
 * (feedItemDedupKey + referenceStrictlyContains) catches the duplicate
 * before it renders. Windowing keeps prompt tokens bounded as the session
 * grows, which was the single biggest cost lever profiled on /extract.
 *
 * citedVerses gets a larger window than highlights/citations because verses
 * tend to be re-referenced across sections of a sermon (intro → application),
 * so keeping more history helps the LLM avoid re-emitting them.
 */
const CITED_VERSES_WINDOW = 24;
const RECENT_DEDUP_WINDOW = 12;

function summarizeExistingForPrompt(items: FeedItem[]) {
  const citedVerses: string[] = [];
  const speakerHighlights: string[] = [];
  const speakerCitations: Array<{ author: string; text: string }> = [];
  for (const it of items) {
    if (it.kind === "citedVerse") citedVerses.push(it.reference);
    else if (it.kind === "speakerHighlight") speakerHighlights.push(it.text);
    else if (it.kind === "speakerCitation")
      speakerCitations.push({ author: it.author, text: it.text });
  }
  return {
    citedVerses: citedVerses.slice(-CITED_VERSES_WINDOW),
    speakerHighlights: speakerHighlights.slice(-RECENT_DEDUP_WINDOW),
    speakerCitations: speakerCitations.slice(-RECENT_DEDUP_WINDOW),
  };
}
