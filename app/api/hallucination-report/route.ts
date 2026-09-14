import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import {
  MAX_HALLUCINATION_NOTE_CHARS,
  parseHallucinationReviewFromLLM,
} from "@/lib/domain/hallucination";
import { serverEnv } from "@/lib/env/server";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { buildLlmMetadata } from "@/lib/llm/metadata";
import { callChat } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { HALLUCINATION_SYSTEM_PROMPT } from "@/lib/prompts/hallucination";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("hallucination-report");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A transcrição vem do banco e pode ser longa; cortamos pelo fim, que é onde
 * o resumo costuma derrapar. */
const SUMMARY_TRANSCRIPT_CHARS = 14_000;

const BodySchema = z
  .object({
    sessionId: UuidSchema,
    note: z.string().trim().min(1).max(MAX_HALLUCINATION_NOTE_CHARS),
  })
  .strict();

function tailOf(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(-maxChars);
}

/**
 * POST /api/hallucination-report
 *
 * O usuário avisa que o Scriba entendeu errado. Cruzamos a nota dele com a
 * transcrição e o material produzido, e devolvemos um veredito: remover cards
 * sem apoio na transcrição (live), sugerir encerrar a gravação, sugerir
 * reprocessar o resumo, ou apenas registrar.
 *
 * Não cobra moedas de propósito: o usuário está reportando um defeito NOSSO.
 * Cobrar por isso ensinaria exatamente o comportamento errado, deixar o
 * problema passar em silêncio. A proteção contra abuso é o rate limit.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["hallucination-report"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId, note } = parsed.data;

  const model = serverEnv.OPENAI_HALLUCINATION_MODEL;

  // A sessão já está salva: lemos do banco em vez de confiar no que o cliente
  // manda.
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  const transcript = tailOf(session.transcript.trim(), SUMMARY_TRANSCRIPT_CHARS);
  const summaryJson = session.finalSummary ? JSON.stringify(session.finalSummary) : null;

  const userMessage = [
    `note: ${note}`,
    summaryJson ? `summary:\n${summaryJson}` : null,
    `---\ntranscript:\n${transcript || "(transcrição vazia)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await callChat({
    model,
    temperature: 0.1,
    maxTokens: 500,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: HALLUCINATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    store: true,
    metadata: buildLlmMetadata({ route: "hallucination-report", userId: auth.user.id, sessionId }),
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      log.error("upstream fetch failed", {
        error: result.error.message,
      });
    } else {
      log.error("upstream error", {
        status: result.error.status,
        snippet: result.error.snippet.slice(0, 300),
      });
    }
    // O alerta do usuário é registrado mesmo quando a auditoria falha, é o
    // dado que não dá para recuperar depois.
    await persistReport({ sessionId, userId: auth.user.id, scope: "summary", note, review: null });
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  const { content, usage, latencyMs, finishReason } = result.data;
  const review = parseHallucinationReviewFromLLM(content);

  log.debug("ok", {
    model,
    latencyMs,
    finishReason,
    verdict: review.verdict,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  });
  await recordChatUsage({
    userId: auth.user.id,
    sessionId,
    route: "hallucination-report",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    latencyMs,
  });
  await persistReport({ sessionId, userId: auth.user.id, scope: "summary", note, review });

  return NextResponse.json(review);
}

async function persistReport(input: {
  sessionId: string;
  userId: string;
  scope: string;
  note: string;
  review: { verdict: string; message: string } | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("hallucination_reports").insert({
      session_id: input.sessionId,
      user_id: input.userId,
      scope: input.scope,
      note: input.note,
      verdict: input.review?.verdict ?? null,
      message: input.review?.message ?? null,
    });
    if (error) {
      log.error("insert failed", { error: error.message });
    }
  } catch (err) {
    log.error("insert threw", { error: (err as Error).message });
  }
}
