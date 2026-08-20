import { NextResponse } from "next/server";
import type { FeedItem } from "@/lib/domain/feed";
import { parseSummaryFromLLM } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single-shot final summary. Runs once after the recording stops, consuming
 * the full transcript AND the feed items already surfaced live. The prompt
 * treats the feed as high-priority curated context: cited verses and speaker
 * highlights should carry through, AI suggestions are kept only if they still
 * fit in the whole. Produces a SummaryPayload rendered by the same view used
 * for the previous live summary.
 */
export async function POST(request: Request) {
  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  let body: { text?: string; feedItems?: FeedItem[] };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  const feedItems = Array.isArray(body.feedItems) ? body.feedItems : [];

  const userMessage = `feedItems:\n${JSON.stringify(feedItems)}\n\n---\ntranscript:\n${text}`;

  const result = await callChat({
    model,
    temperature: 0.2,
    // 4k was truncating dense 40-60min sermons (Nicodemus, expositional
    // preaching): the finishReason=length warn was firing and the resumo
    // was arriving cut short. 12k gives room for the resumo to grow
    // proportionally to content density without capping doctrinal depth.
    maxTokens: 12000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: FINAL_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[final-summary] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    console.error("[final-summary] upstream error", {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs },
      { status: 502 }
    );
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const payload = parseSummaryFromLLM(content, "final");

  console.log("[final-summary] ok", {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
    feedItems: feedItems.length,
    title: payload.title.slice(0, 60),
  });
  if (finishReason === "length") {
    console.warn("[final-summary] output truncated by max_tokens", {
      completionTokens: usage.completionTokens,
    });
  }

  return NextResponse.json({ ...payload, latencyMs, model });
}
