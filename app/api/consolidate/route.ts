import { NextResponse } from "next/server";
import { parseProposalsFromLLM } from "@/lib/domain/consolidate";
import type { SummaryBlock } from "@/lib/domain/summary";
import { serverEnv } from "@/lib/env/server";
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

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
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
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CONSOLIDATE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (err) {
    console.error("[consolidate] upstream fetch failed", { error: (err as Error).message });
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}`, proposals: [] },
      { status: 502 }
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const raw = await upstream.text();
  if (!upstream.ok) {
    console.error("[consolidate] upstream error", {
      status: upstream.status,
      latencyMs,
      snippet: raw.slice(0, 300),
    });
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}`, proposals: [] },
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
  const proposals = parseProposalsFromLLM(content, blocks);
  console.log("[consolidate] ok", {
    latencyMs,
    finishReason,
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    proposals: proposals.length,
  });
  return NextResponse.json({ proposals, latencyMs, model });
}
