import { NextResponse } from "next/server";
import { recordChatUsage } from "@/lib/db/usage";
import { type FeedItem, feedItemDedupKey, parseBibleFromLLM } from "@/lib/domain/feed";
import { serverEnv } from "@/lib/env/server";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { devLog } from "@/lib/log";
import { BIBLE_SYSTEM_PROMPT } from "@/lib/prompts/bible";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live "bible" pipeline: só emite citedVerse. O cliente já filtrou via regex
 * que há sinal de menção bíblica no trecho antes de chamar — a rota confirma
 * e normaliza a referência, ou devolve items vazio em caso de falso alarme.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const model = serverEnv.OPENAI_BIBLE_MODEL;

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
    temperature: 0.2,
    maxTokens: 300,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: BIBLE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "bible", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[bible] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, items: [] },
        { status: 502 }
      );
    }
    console.error("[bible] upstream error", {
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
  const { items, drops } = parseBibleFromLLM(content, existingKeys);
  for (const d of drops) {
    if (d.reason === "dedup") continue;
    console.warn("[bible] schema-drop", d);
  }
  devLog("[bible] ok", {
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
    sessionId,
    route: "bible",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
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
 * Compacta o feed no mínimo que o prompt do bible precisa pra dedup. Passa
 * TODAS as citedVerses (a regra de "contido-em" precisa do histórico
 * completo) e nenhum outro kind — bible não emite mais nada.
 */
function summarizeExistingForPrompt(items: FeedItem[]) {
  const citedVerses: string[] = [];
  for (const it of items) {
    if (it.kind === "citedVerse") citedVerses.push(it.reference);
  }
  return { citedVerses };
}
