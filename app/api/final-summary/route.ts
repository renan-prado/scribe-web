import { NextResponse } from "next/server";
import { updateSessionFinal } from "@/lib/db/sessions";
import type { FeedItem } from "@/lib/domain/feed";
import { parseSummaryFromLLM } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/final-summary";
import { requireAuth } from "@/lib/supabase/require-auth";

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
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const model = serverEnv.OPENAI_FINAL_SUMMARY_MODEL;

  let body: {
    sessionId?: string;
    text?: string;
    feedItems?: FeedItem[];
    durationMs?: number;
    speakerName?: string;
    speakerLocation?: string;
  };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
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
  });
  if (finishReason === "length") {
    console.warn("[final-summary] output truncated by max_tokens", {
      completionTokens: usage.completionTokens,
    });
  }

  // Fill the row created at start. Never fail the request on save error —
  // the user already sat through the recording; return the summary and log
  // for investigation. RLS scopes the update to the session's owner.
  let saved = false;
  try {
    await updateSessionFinal(sessionId, {
      transcript: text,
      feedItems,
      summary: payload,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
      speakerName: typeof body.speakerName === "string" ? body.speakerName.trim() || null : null,
      speakerLocation:
        typeof body.speakerLocation === "string" ? body.speakerLocation.trim() || null : null,
    });
    saved = true;
    console.log("[final-summary] saved", { sessionId });
  } catch (err) {
    console.error("[final-summary] save failed", { sessionId, error: (err as Error).message });
  }

  return NextResponse.json({ ...payload, latencyMs, model, sessionId, saved });
}
