import { NextResponse } from "next/server";
import {
  normalizePreviousForPrompt,
  parseSummaryFromLLM,
  type SummaryPayload,
  type SummaryPhase,
} from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { buildSummarizeSystemPrompt } from "@/lib/prompts/summarize";

// Re-export domain types so existing consumers that import from this route
// (app/api/consolidate, app/api/insights) keep working during the refactor.
export type { SummaryBlock, SummaryPayload, SummaryPhase } from "@/lib/domain/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const model = serverEnv.OPENAI_SUMMARY_MODEL;

  let body: {
    text?: string;
    phase?: SummaryPhase;
    isFinal?: boolean;
    elapsedSec?: number;
    previous?: SummaryPayload;
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
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  const phase = resolvePhase(body.phase, body.isFinal, text, body.elapsedSec);
  const systemPrompt = buildSummarizeSystemPrompt(phase);

  const previous = normalizePreviousForPrompt(body.previous);
  const userMessage = previous
    ? `previousSummary:\n${JSON.stringify(previous)}\n\n---\ntranscript:\n${text}`
    : `transcript:\n${text}`;

  const result = await callChat({
    model,
    temperature: 0.2,
    maxTokens: 4000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[summarize] upstream fetch failed", { phase, error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    console.error("[summarize] upstream error", {
      phase,
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
  const payload = parseSummaryFromLLM(content, phase);

  console.log("[summarize] ok", {
    phase,
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    blocks: payload.blocks.length,
    title: payload.title.slice(0, 60),
  });
  if (finishReason === "length") {
    console.warn("[summarize] output truncated by max_tokens", {
      phase,
      completionTokens: usage.completionTokens,
    });
  }

  return NextResponse.json({ ...payload, phase, latencyMs, model });
}

function resolvePhase(
  requested: SummaryPhase | undefined,
  isFinal: boolean | undefined,
  text: string,
  elapsedSec: number | undefined
): SummaryPhase {
  if (isFinal) return "final";
  if (
    requested === "final" ||
    requested === "mature" ||
    requested === "developing" ||
    requested === "intro"
  ) {
    return requested;
  }
  // Primary signal: elapsed recording time. Word count is a safety net so the
  // model can escalate if someone speaks fast in a short talk.
  const elapsed = typeof elapsedSec === "number" && elapsedSec >= 0 ? elapsedSec : 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const timePhase: SummaryPhase = elapsed < 60 ? "intro" : elapsed < 300 ? "developing" : "mature";
  const wordPhase: SummaryPhase =
    wordCount < 40 ? "intro" : wordCount < 250 ? "developing" : "mature";
  // Escalate to the more advanced of the two so runaway silence doesn't lock
  // us in intro forever, and a burst of words doesn't skip past a real intro.
  const order: Record<SummaryPhase, number> = {
    intro: 0,
    developing: 1,
    mature: 2,
    final: 3,
  };
  return order[timePhase] >= order[wordPhase] ? timePhase : wordPhase;
}
