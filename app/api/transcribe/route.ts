import { NextResponse } from "next/server";
import { recordAudioUsage } from "@/lib/db/usage";
import { serverEnv } from "@/lib/env/server";
import { isUuid } from "@/lib/http/validate";
import { callTranscribe } from "@/lib/llm/openai";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";
import { sanitizeTranscription } from "@/lib/transcription/sanitize";
import { VOCABULARIO_PROMPT } from "@/lib/vocabulario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — OpenAI's limit
const ALLOWED_EXTENSIONS = new Set(["webm", "mp4", "mp3", "wav", "ogg", "m4a", "flac"]);
// `prevText` seeds the Whisper prompt with the transcript tail; the recorder
// sends at most a few hundred chars in practice. Cap defends against a
// scripted client stuffing the prompt with an unbounded payload.
const MAX_PREV_TEXT_CHARS = 4000;
// A single chunk is ~30s; anything above 5min is either a bug or abuse.
const MAX_DURATION_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.transcribe, auth.user.id);
  if (limited) return limited;

  const model = serverEnv.OPENAI_TRANSCRIBE_MODEL;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid multipart body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  const chunkIndex = form.get("chunkIndex");
  const prevTextRaw = (form.get("prevText") as string | null) ?? "";
  const prevText =
    prevTextRaw.length > MAX_PREV_TEXT_CHARS
      ? prevTextRaw.slice(-MAX_PREV_TEXT_CHARS)
      : prevTextRaw;
  const extension = ((form.get("extension") as string | null) ?? "webm").toLowerCase();
  const sessionIdRaw = form.get("sessionId");
  const sessionIdCandidate =
    typeof sessionIdRaw === "string" && sessionIdRaw.trim() ? sessionIdRaw.trim() : null;
  const sessionId = isUuid(sessionIdCandidate) ? sessionIdCandidate : null;
  const durationMsRaw = form.get("durationMs");
  const durationMs = typeof durationMsRaw === "string" ? Number.parseFloat(durationMsRaw) : NaN;
  const audioSeconds =
    Number.isFinite(durationMs) && durationMs > 0
      ? Math.min(durationMs, MAX_DURATION_MS) / 1000
      : 0;
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
  }

  const filename = `chunk-${chunkIndex ?? "x"}.${extension}`;
  const prompt = prevText ? `${VOCABULARIO_PROMPT} ${prevText}` : VOCABULARIO_PROMPT;

  const result = await callTranscribe({
    model,
    file,
    filename,
    prompt,
    language: "pt",
  });

  if (!result.ok) {
    if (result.error.kind === "fetch") {
      return NextResponse.json(
        { error: `upstream fetch failed: ${result.error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: result.error.message, latencyMs: result.error.latencyMs, model },
      { status: 502 }
    );
  }

  await recordAudioUsage({
    sessionId,
    route: "transcribe",
    model,
    audioSeconds,
    latencyMs: result.data.latencyMs,
  });
  // Rede de segurança: remove assinaturas conhecidas de alucinação (eco do
  // prompt-guia, eco do vocabulário, loop de sentença repetida) antes de
  // devolver ao client. `suspect` avisa o client para não reutilizar este
  // chunk como contexto (prevText/pipelines) — ver lib/transcription/sanitize.
  const sanitized = sanitizeTranscription(result.data.text);
  if (sanitized.suspect) {
    console.warn("[transcribe] hallucination-signature", {
      chunkIndex: chunkIndex ?? null,
      promptEcho: sanitized.promptEcho,
      vocabEcho: sanitized.vocabEcho,
      repetitionLoop: sanitized.repetitionLoop,
      rawChars: result.data.text.length,
      cleanChars: sanitized.text.length,
    });
  }
  return NextResponse.json({
    text: sanitized.text,
    suspect: sanitized.suspect,
    latencyMs: result.data.latencyMs,
    model,
  });
}
