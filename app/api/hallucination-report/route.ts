import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/db/sessions";
import { recordChatUsage } from "@/lib/db/usage";
import { coerceFeedItemsLoose, type FeedItem, feedItemDedupKey } from "@/lib/domain/feed";
import {
  HALLUCINATION_SCOPES,
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

/** Cauda de transcrição enviada ao auditor no escopo live. Cobre vários
 * minutos de fala — o suficiente para julgar os cards visíveis sem inflar o
 * prompt com a sessão inteira. */
const LIVE_TRANSCRIPT_CHARS = 6_000;
/** No escopo summary a transcrição vem do banco e pode ser longa; cortamos
 * pelo fim, que é onde o resumo costuma derrapar. */
const SUMMARY_TRANSCRIPT_CHARS = 14_000;

const BodySchema = z
  .object({
    sessionId: UuidSchema,
    scope: z.enum(HALLUCINATION_SCOPES),
    note: z.string().trim().min(1).max(MAX_HALLUCINATION_NOTE_CHARS),
    /** Escopo live: cauda da transcrição corrente (nada foi salvo ainda). */
    text: z.string().max(20_000).optional(),
    /** Escopo live: cards visíveis no feed, na ordem em que aparecem. */
    feedItems: z.array(z.unknown()).max(500).optional(),
  })
  .strict();

function tailOf(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(-maxChars);
}

/** Achata um card para o prompt: só o que importa para julgar ancoragem. */
function itemForPrompt(item: FeedItem, index: number): Record<string, unknown> {
  const base: Record<string, unknown> = { index, kind: item.kind };
  if ("reference" in item && item.reference) base.reference = item.reference;
  if ("author" in item && item.author) base.author = item.author;
  if ("label" in item && item.label) base.label = item.label;
  if ("text" in item && item.text) base.text = item.text;
  return base;
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
 * Cobrar por isso ensinaria exatamente o comportamento errado — deixar o
 * problema passar em silêncio. A proteção contra abuso é o rate limit.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["hallucination-report"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId, scope, note } = parsed.data;

  const model = serverEnv.OPENAI_HALLUCINATION_MODEL;

  // No escopo live nada foi persistido ainda, então a transcrição e os cards
  // vêm do cliente. No escopo summary a sessão já está salva — lemos do banco
  // em vez de confiar no que o cliente manda.
  let transcript = "";
  let items: FeedItem[] = [];
  let summaryJson: string | null = null;

  if (scope === "live") {
    transcript = tailOf((parsed.data.text ?? "").trim(), LIVE_TRANSCRIPT_CHARS);
    items = coerceFeedItemsLoose(parsed.data.feedItems ?? []);
  } else {
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    transcript = tailOf(session.transcript.trim(), SUMMARY_TRANSCRIPT_CHARS);
    summaryJson = session.finalSummary ? JSON.stringify(session.finalSummary) : null;
  }

  const promptItems = items.map(itemForPrompt);
  const userMessage = [
    `scope: ${scope}`,
    `note: ${note}`,
    promptItems.length > 0 ? `items:\n${JSON.stringify(promptItems)}` : null,
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
    // O alerta do usuário é registrado mesmo quando a auditoria falha — é o
    // dado que não dá para recuperar depois.
    await persistReport({ sessionId, userId: auth.user.id, scope, note, review: null });
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  const { content, usage, latencyMs, finishReason } = result.data;
  const review = parseHallucinationReviewFromLLM(content, (index) =>
    index < items.length ? feedItemDedupKey(items[index]) : null
  );

  log.debug("ok", {
    model,
    latencyMs,
    finishReason,
    scope,
    verdict: review.verdict,
    removed: review.removeKeys.length,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  });
  await recordChatUsage({
    sessionId,
    route: "hallucination-report",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cachedTokens: usage.cachedTokens,
    latencyMs,
  });
  await persistReport({ sessionId, userId: auth.user.id, scope, note, review });

  return NextResponse.json(review);
}

async function persistReport(input: {
  sessionId: string;
  userId: string;
  scope: string;
  note: string;
  review: { verdict: string; message: string; removeKeys: string[] } | null;
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
      removed_count: input.review?.removeKeys.length ?? 0,
    });
    if (error) {
      log.error("insert failed", { error: error.message });
    }
  } catch (err) {
    log.error("insert threw", { error: (err as Error).message });
  }
}
