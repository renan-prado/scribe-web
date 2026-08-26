import { NextResponse } from "next/server";
import { z } from "zod";
import { recordChatUsage } from "@/lib/db/usage";
import { serverEnv } from "@/lib/env/server";
import { OptionalUuidSchema, parseJsonBody } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { FORMAT_PARAGRAPHS_SYSTEM_PROMPT } from "@/lib/prompts/format-paragraphs";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

// A full transcript can be hundreds of KB for long sermons. 300k is well
// above the observed p99 while still keeping a single request from evaluating
// to an unbounded OpenAI token bill.
const BodySchema = z
  .object({
    text: z.string().max(300_000),
    sessionId: OptionalUuidSchema,
  })
  .strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["format-paragraphs"], auth.user.id);
  if (limited) return limited;

  const model = serverEnv.OPENAI_FORMAT_MODEL;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const text = parsed.data.text.trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }

  const sessionId = parsed.data.sessionId ?? null;
  const result = await callChat({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: FORMAT_PARAGRAPHS_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "format-paragraphs", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs },
      { status: 502 }
    );
  }

  await recordChatUsage({
    sessionId,
    route: "format-paragraphs",
    model,
    promptTokens: result.data.usage.promptTokens,
    completionTokens: result.data.usage.completionTokens,
    cachedTokens: result.data.usage.cachedTokens,
    latencyMs: result.data.latencyMs,
  });
  return NextResponse.json({
    formatted: result.data.content,
    latencyMs: result.data.latencyMs,
    model,
  });
}
