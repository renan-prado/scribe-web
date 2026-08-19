import { NextResponse } from "next/server";
import { parseInsightsFromLLM } from "@/lib/domain/insights";
import type { SummaryBlock } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { INSIGHTS_SYSTEM_PROMPT } from "@/lib/prompts/insights";

// Re-export domain types so client-side imports that used to reach into this
// route file keep resolving during the refactor.
export type {
  Insight,
  InsightBibleReference,
  InsightSupportingContent,
  InsightsPayload,
} from "@/lib/domain/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
  const model = serverEnv.OPENAI_INSIGHTS_MODEL;

  let body: { text?: string; blocks?: SummaryBlock[]; existingInsightIndices?: number[] };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const text = (body.text ?? "").trim();
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const existingIndices = Array.isArray(body.existingInsightIndices)
    ? body.existingInsightIndices.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n)
      )
    : [];
  if (!text || blocks.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const indexedBlocks = blocks.map((b, i) => ({ index: i, ...b }));
  const userMessage = `existingInsightIndices: ${JSON.stringify(existingIndices)}\n\nblocks:\n${JSON.stringify(indexedBlocks)}\n\n---\ntranscript:\n${text}`;

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
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    console.error("[insights] upstream fetch failed", { error: (err as Error).message });
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}`, insights: [] },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    console.error("[insights] upstream error", {
      status: upstream.status,
      latencyMs,
      snippet: raw.slice(0, 300),
    });
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, latencyMs, insights: [] },
      { status: 502 }
    );
  }

  let parsed: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  const finishReason = parsed.choices?.[0]?.finish_reason ?? "";

  const insights = parseInsightsFromLLM(content, blocks, existingIndices);
  console.log("[insights] ok", {
    latencyMs,
    finishReason,
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    insights: insights.length,
  });
  return NextResponse.json({ insights, latencyMs, model });
}
