import { NextResponse } from "next/server";
import {
  normalizePreviousForPrompt,
  parseSummaryFromLLM,
  type SummaryPayload,
  type SummaryPhase,
} from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { buildSummarizeSystemPrompt } from "@/lib/prompts/summarize";

// Re-export domain types so existing consumers that import from this route
// (app/api/consolidate, app/api/insights) keep working during the refactor.
export type { SummaryBlock, SummaryPayload, SummaryPhase } from "@/lib/domain/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
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

  const startedAt = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    console.error("[summarize] upstream fetch failed", {
      phase,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    console.error("[summarize] upstream error", {
      phase,
      status: upstream.status,
      latencyMs,
      snippet: raw.slice(0, 300),
    });
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, latencyMs },
      { status: 502 }
    );
  }

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  const finishReason = parsed.choices?.[0]?.finish_reason ?? "";

  const payload = parseSummaryFromLLM(content, phase);

  console.log("[summarize] ok", {
    phase,
    latencyMs,
    finishReason,
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    blocks: payload.blocks.length,
    title: payload.title.slice(0, 60),
  });
  if (finishReason === "length") {
    console.warn("[summarize] output truncated by max_tokens", {
      phase,
      completionTokens: parsed.usage?.completion_tokens,
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
