import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertLocationByName } from "@/lib/db/locations";
import { getSession, updateSessionTranscript } from "@/lib/db/sessions";
import { upsertSpeakerByName } from "@/lib/db/speakers";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("sessions/transcript");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tamanho do trecho da transcrição usado como preview no card da lista. */
const PREVIEW_CHARS = 180;

const BodySchema = z
  .object({
    transcript: z.string().min(1).max(500_000),
    durationMs: z.number().int().nonnegative().nullable().optional(),
    title: z.string().trim().max(200).nullable().optional(),
    speakerName: z.string().trim().max(200).nullable().optional(),
    speakerLocation: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

/**
 * Corta as primeiras frases da transcrição para servir de preview no card da
 * lista. Não é um resumo — modo transcrição não chama LLM nenhum além do
 * transcribe. Quebra na fronteira de palavra e sufixa reticências.
 */
function transcriptPreview(transcript: string): string | null {
  const flat = transcript.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= PREVIEW_CHARS) return flat;
  const head = flat.slice(0, PREVIEW_CHARS);
  const lastSpace = head.lastIndexOf(" ");
  return `${(lastSpace > 40 ? head.slice(0, lastSpace) : head).replace(/[\s.,;:]+$/, "")}…`;
}

/**
 * PUT /api/sessions/:id/transcript
 *
 * Fecha uma sessão do modo transcrição. É o análogo do POST /api/final-summary
 * para os outros modos, mas sem nenhuma chamada de LLM: recebe o texto que o
 * cliente montou a partir dos chunks já transcritos e grava a linha.
 * `final_summary` permanece null — é isso que marca a sessão como "só
 * transcrição" para a página salva e para a lista.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-transcript"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  // RLS já escopa o UPDATE ao dono; a leitura aqui é só pra recusar o save
  // quando a sessão não é do modo transcrição (evita que uma chamada torta
  // apague o feed de uma sessão live).
  const session = await getSession(id).catch(() => null);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.mode !== "transcript_only") {
    return NextResponse.json({ error: "wrong_mode" }, { status: 409 });
  }

  const transcript = parsed.data.transcript.trim();
  if (!transcript) return NextResponse.json({ error: "empty_transcript" }, { status: 400 });

  const title = parsed.data.title?.trim() || null;
  const speakerName = parsed.data.speakerName?.trim() || null;
  const speakerLocation = parsed.data.speakerLocation?.trim() || null;

  // Promove autor/local a entidades reutilizáveis, como faz o PATCH de meta.
  // Falha aqui não impede o save — o texto é o que o usuário está esperando.
  let speakerId: string | null | undefined;
  let locationId: string | null | undefined;
  if (speakerName) {
    try {
      speakerId = (await upsertSpeakerByName({ name: speakerName, userId: auth.user.id })).id;
    } catch (err) {
      log.error("speaker upsert failed", {
        error: (err as Error).message,
      });
    }
  }
  if (speakerLocation) {
    try {
      locationId = (await upsertLocationByName({ name: speakerLocation, userId: auth.user.id })).id;
    } catch (err) {
      log.error("location upsert failed", {
        error: (err as Error).message,
      });
    }
  }

  try {
    await updateSessionTranscript(id, {
      transcript,
      durationMs: parsed.data.durationMs ?? null,
      title,
      shortSummary: transcriptPreview(transcript),
      speakerName,
      speakerLocation,
      speakerId,
      locationId,
    });
    log.debug("saved", { id, chars: transcript.length });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("save failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
