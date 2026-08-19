import { NextResponse } from "next/server";
import { parseInsightsFromLLM } from "@/lib/domain/insights";
import type { SummaryBlock } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
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

export async function POST(request: Request) {
  const model = serverEnv.OPENAI_INSIGHTS_MODEL;

  let body: {
    text?: string;
    blocks?: SummaryBlock[];
    existingInsightIndices?: number[];
    existingSupportingContent?: Array<{ label?: unknown; text?: unknown; source?: unknown }>;
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
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const existingIndices = Array.isArray(body.existingInsightIndices)
    ? body.existingInsightIndices.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n)
      )
    : [];
  const existingSupportingContent = Array.isArray(body.existingSupportingContent)
    ? body.existingSupportingContent
        .map((it) => ({
          label: typeof it?.label === "string" ? it.label : "",
          text: typeof it?.text === "string" ? it.text : "",
          source: typeof it?.source === "string" ? it.source : "",
        }))
        .filter((it) => it.label && it.text)
        .map((it) => (it.source ? it : { label: it.label, text: it.text }))
    : [];
  if (!text || blocks.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const indexedBlocks = blocks.map((b, i) => ({ index: i, ...b }));
  const userMessage = `existingInsightIndices: ${JSON.stringify(existingIndices)}\n\nexistingSupportingContent: ${JSON.stringify(existingSupportingContent)}\n\nblocks:\n${JSON.stringify(indexedBlocks)}\n\n---\ntranscript:\n${text}`;

  const result = await callChat({
    model,
    temperature: 0.3,
    maxTokens: 1500,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[insights] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, insights: [] },
        { status: 502 }
      );
    }
    console.error("[insights] upstream error", {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs, insights: [] },
      { status: 502 }
    );
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const insights = parseInsightsFromLLM(content, blocks, existingIndices);
  console.log("[insights] ok", {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    insights: insights.length,
  });
  return NextResponse.json({ insights, latencyMs, model });
}
