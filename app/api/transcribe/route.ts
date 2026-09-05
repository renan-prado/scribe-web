import { NextResponse } from "next/server";
import { requireBalance } from "@/lib/coins/require-balance";
import { recordAudioUsage } from "@/lib/db/usage";
import { serverEnv } from "@/lib/env/server";
import { isUuid } from "@/lib/http/validate";
import { callTranscribe } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { enforceAudioBudget, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  assessmentPenalty,
  assessTranscription,
  modelSupportsLogprobs,
} from "@/lib/transcription/quality";
import { VOCABULARIO_PROMPT } from "@/lib/vocabulario";

const log = createLogger("transcribe");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 8 MB, e NÃO os 25 MB da OpenAI.
//
// O 25 aqui era o limite DELES copiado para cá, e limite de terceiro não é
// política nossa. Um chunk real tem 15-20s (`RECORDER_MIN/MAX_CHUNK_MS`) e pesa
// uns 80 KB em opus; o teto do formato permitia 300 vezes isso. E o que se
// compra com esse excedente não é folga: a OpenAI cobra por MINUTO de áudio, e
// 25 MB de opus são mais de duas horas de som num único POST — $0,42 por
// chamada, num endpoint que aceita 40 por minuto.
//
// 8 MB cobre cinco minutos a 200 kbps, que é o teto que `MAX_DURATION_MS` já
// declarava esperar, com margem de sobra para qualquer codec que um navegador
// escolha. O corte fino é o orçamento de bytes por hora, logo abaixo.
const MAX_FILE_BYTES = 8 * 1024 * 1024;
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

  // A cobrança por minuto é emitida pelo cliente; este piso é o que impede uma
  // conta zerada de transcrever de graça só por não chamar /api/coins/charge.
  const broke = requireBalance(auth.user);
  if (broke) return broke;

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
  // O limitador por chamada conta REQUISIÇÕES; a OpenAI cobra MINUTOS. Este é o
  // balde que fecha a diferença — ver `enforceAudioBudget`. Fica depois do
  // corte de tamanho de propósito: um POST recusado por ser grande demais não
  // deve consumir o orçamento de quem talvez nem seja o dono do defeito.
  const overBudget = enforceAudioBudget(auth.user.id, file.size);
  if (overBudget) return overBudget;
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
  // Sessão já promovida pelo client (sequência de chunks ruins) transcreve
  // direto no modelo escalado — evita pagar mini + escalado em todo chunk de
  // uma sessão com áudio sabidamente ruim.
  const tier = form.get("tier") === "escalated" ? "escalated" : "standard";
  const standardModel = serverEnv.OPENAI_TRANSCRIBE_MODEL;
  const escalatedModel = serverEnv.OPENAI_TRANSCRIBE_ESCALATED_MODEL;
  const model = tier === "escalated" ? escalatedModel : standardModel;

  // `chunkIndex` é o único campo do form que ia inteiro para dentro de uma
  // string, e essa string vira o `filename` do multipart que mandamos para a
  // OpenAI. O `FormData` do undici percent-encoda aspas e CRLF, então não havia
  // injeção de cabeçalho ali — verificado. O que faltava era o limite: nada
  // impedia um `chunkIndex` de um megabyte. Só dígito, no máximo seis.
  const chunkLabel =
    typeof chunkIndex === "string" && /^\d{1,6}$/.test(chunkIndex) ? chunkIndex : "x";
  const filename = `chunk-${chunkLabel}.${extension}`;
  const prompt = prevText ? `${VOCABULARIO_PROMPT} ${prevText}` : VOCABULARIO_PROMPT;

  const transcribeWith = (m: string) =>
    callTranscribe({
      model: m,
      file,
      filename,
      prompt,
      language: "pt",
      include: modelSupportsLogprobs(m) ? ["logprobs"] : undefined,
    });

  const result = await transcribeWith(model);

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
    userId: auth.user.id,
    sessionId,
    route: "transcribe",
    model,
    audioSeconds,
    latencyMs: result.data.latencyMs,
  });

  // Rede de segurança em três frentes (ver lib/transcription/quality):
  // sanitização determinística de assinaturas de alucinação + piso de
  // confiança via logprobs + piso de densidade de texto por segundo de
  // áudio. `poor` marca o chunk como suspeito para o client
  // (fora do prevText/pipelines) e, no tier standard, dispara uma segunda
  // tentativa com o modelo escalado usando o MESMO áudio.
  let assessment = assessTranscription(result.data.text, result.data.avgLogprob, audioSeconds);
  let chosenModel = model;
  let latencyMs = result.data.latencyMs;
  let escalated = tier === "escalated";

  if (tier === "standard" && assessment.poor && escalatedModel !== standardModel) {
    const retry = await transcribeWith(escalatedModel);
    if (retry.ok) {
      await recordAudioUsage({
        userId: auth.user.id,
        sessionId,
        route: "transcribe",
        model: escalatedModel,
        audioSeconds,
        latencyMs: retry.data.latencyMs,
      });
      const retryAssessment = assessTranscription(
        retry.data.text,
        retry.data.avgLogprob,
        audioSeconds
      );
      // Empate favorece o modelo escalado: mesma contagem de assinaturas
      // ruins, mas decodificação mais robusta por trás.
      if (assessmentPenalty(retryAssessment) <= assessmentPenalty(assessment)) {
        assessment = retryAssessment;
        chosenModel = escalatedModel;
      }
      latencyMs += retry.data.latencyMs;
      escalated = true;
    }
  }

  if (assessment.poor || escalated) {
    log.warn("quality", {
      chunkIndex: chunkIndex ?? null,
      tier,
      chosenModel,
      escalated,
      promptEcho: assessment.promptEcho,
      vocabEcho: assessment.vocabEcho,
      repetitionLoop: assessment.repetitionLoop,
      lowConfidence: assessment.lowConfidence,
      lowDensity: assessment.lowDensity,
      audioSeconds,
      avgLogprob: assessment.avgLogprob,
      cleanChars: assessment.text.length,
    });
  }

  return NextResponse.json({
    text: assessment.text,
    suspect: assessment.poor,
    escalated,
    latencyMs,
    model: chosenModel,
  });
}
