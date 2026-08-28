import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertLocationByName } from "@/lib/db/locations";
import { updateSessionFinal } from "@/lib/db/sessions";
import { upsertSpeakerByName } from "@/lib/db/speakers";
import { FeedItemSchema } from "@/lib/domain/feed";
import { generateFinalSummary } from "@/lib/final-summary/generate";
import { parseJsonBody, UuidSchema } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { generateAndSavePractices } from "@/lib/practices/save";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateAndSaveRereads } from "@/lib/rereads/save";
import { requireAuth } from "@/lib/supabase/require-auth";

// Sermons run 30-90min in practice; the transcript we've observed maxes out
// around ~150k chars. 300k is 2× headroom without letting a bot smuggle an
// unbounded prompt through this endpoint (which is expensive: gpt-4-class
// model, 12k output tokens).
// feedItems is strictly validated — this array is persisted to the DB, so a
// malformed entry from a compromised client would poison future reads.
// 2000 items is far above any real recording; the live feed rarely tops 150.
const MAX_TEXT_CHARS = 300_000;
const MAX_FEED_ITEMS = 2000;
const MAX_SESSION_HOURS_MS = 12 * 60 * 60 * 1000;

const BodySchema = z
  .object({
    sessionId: UuidSchema,
    text: z.string().max(MAX_TEXT_CHARS),
    feedItems: z.array(FeedItemSchema).max(MAX_FEED_ITEMS).optional(),
    durationMs: z.number().finite().nonnegative().max(MAX_SESSION_HOURS_MS).optional(),
    speakerName: z.string().max(200).optional(),
    speakerLocation: z.string().max(200).optional(),
  })
  .strict();

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

  const limited = enforceRateLimit(request, RATE_LIMITS["final-summary"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const sessionId = body.sessionId;
  const text = body.text.trim();
  if (!text) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  const feedItems = body.feedItems ?? [];

  const result = await generateFinalSummary({
    userId: auth.user.id,
    sessionId,
    transcript: text,
    feedItems,
    logPrefix: "final-summary",
    metadataRoute: "final-summary",
  });

  if (!result.ok) {
    if (result.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.message, latencyMs: result.latencyMs },
      { status: 502 }
    );
  }

  const { payload, latencyMs, model } = result;

  // Fill the row created at start. Never fail the request on save error —
  // the user already sat through the recording; return the summary and log
  // for investigation. RLS scopes the update to the session's owner.
  const speakerName = body.speakerName?.trim() || null;
  const speakerLocation = body.speakerLocation?.trim() || null;

  // Promote speaker/location free-text into per-user entities so they show up
  // in future autocomplete lists ranked by usage. Best-effort — the actual
  // session save must not fail on an entity upsert glitch.
  let speakerId: string | null | undefined;
  let locationId: string | null | undefined;
  if (speakerName) {
    try {
      const s = await upsertSpeakerByName({ name: speakerName, userId: auth.user.id });
      speakerId = s.id;
    } catch (err) {
      console.error("[final-summary] speaker upsert failed", {
        sessionId,
        error: (err as Error).message,
      });
    }
  } else {
    speakerId = null;
  }
  if (speakerLocation) {
    try {
      const l = await upsertLocationByName({ name: speakerLocation, userId: auth.user.id });
      locationId = l.id;
    } catch (err) {
      console.error("[final-summary] location upsert failed", {
        sessionId,
        error: (err as Error).message,
      });
    }
  } else {
    locationId = null;
  }

  let saved = false;
  try {
    await updateSessionFinal(sessionId, {
      transcript: text,
      feedItems,
      summary: payload,
      durationMs: body.durationMs ?? null,
      speakerName,
      speakerLocation,
      speakerId,
      locationId,
    });
    saved = true;
    devLog("[final-summary] saved", { sessionId });
  } catch (err) {
    console.error("[final-summary] save failed", { sessionId, error: (err as Error).message });
  }

  // Best-effort: gera e persiste "Coloque em prática" (5 itens) e "Releia este
  // texto" (10 versículos) em paralelo após o resumo estar salvo. Nenhuma das
  // duas falhas quebra a resposta do resumo — a UI trata payloads ausentes como
  // estado normal (só o resumo será renderizado).
  const [practices, rereads] = await Promise.all([
    generateAndSavePractices({
      userId: auth.user.id,
      sessionId,
      transcript: text,
      feedItems,
      finalSummary: payload,
      logPrefix: "practices",
    }),
    generateAndSaveRereads({
      userId: auth.user.id,
      sessionId,
      transcript: text,
      feedItems,
      finalSummary: payload,
      logPrefix: "rereads",
    }),
  ]);

  return NextResponse.json({
    ...payload,
    latencyMs,
    model,
    sessionId,
    saved,
    practices,
    rereads,
  });
}
