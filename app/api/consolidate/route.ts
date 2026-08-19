import { NextResponse } from "next/server";
import { parseProposalsFromLLM } from "@/lib/domain/consolidate";
import type { SummaryBlock } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
import { callChat } from "@/lib/llm/openai";
import { CONSOLIDATE_SYSTEM_PROMPT } from "@/lib/prompts/consolidate";

// Re-export domain types so client-side imports that used to reach into this
// route file keep resolving during the refactor.
export type {
  ConsolidatePayload,
  InsertHeadingProposal,
  MergeProposal,
  Proposal,
  RefineProposal,
} from "@/lib/domain/consolidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const model = serverEnv.OPENAI_CONSOLIDATE_MODEL;

  let body: { blocks?: SummaryBlock[]; isFinal?: boolean };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (blocks.length < 3) {
    return NextResponse.json({ proposals: [] });
  }

  const indexedBlocks = blocks.map((b, i) => ({ index: i, ...b }));
  const userMessage = `blocks:\n${JSON.stringify(indexedBlocks)}`;

  const result = await callChat({
    model,
    temperature: 0.1,
    maxTokens: 1500,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: CONSOLIDATE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      console.error("[consolidate] upstream fetch failed", { error: result.error.message });
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}`, proposals: [] },
        { status: 502 }
      );
    }
    console.error("[consolidate] upstream error", {
      status: result.error.status,
      latencyMs: result.error.latencyMs,
      snippet: result.error.snippet.slice(0, 300),
    });
    return NextResponse.json({ error: result.error.message, proposals: [] }, { status: 502 });
  }

  const { content, finishReason, usage, latencyMs } = result.data;
  const proposals = parseProposalsFromLLM(content, blocks);
  console.log("[consolidate] ok", {
    latencyMs,
    finishReason,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    proposals: proposals.length,
  });
  return NextResponse.json({ proposals, latencyMs, model });
}
