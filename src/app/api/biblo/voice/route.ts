import { NextResponse } from "next/server";
import { resolveBibloVoiceAllowance } from "@/features/session/server/biblo/allowance";
import { chargeCoins } from "@/lib/db/coins";
import { getSessionView } from "@/lib/db/sessions";
import { recordAudioUsage } from "@/lib/db/usage";
import { BIBLO_VOICE_MAX_MS, type BibloVoiceTurn } from "@/lib/domain/biblo";
import { serverEnv } from "@/lib/env/server";
import { isUuid } from "@/lib/http/validate";
import { callTranscribe } from "@/lib/llm/openai";
import { createLogger } from "@/lib/log";
import { enforceAudioBudget, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("biblo-voice");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uma chamada de STT sobre até 60s de áudio: 2-6s no caso normal. Mesma folga
// de `/api/transcribe` para a cauda, não expectativa.
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = new Set(["webm", "mp4", "mp3", "wav", "ogg", "m4a"]);

/**
 * Teto de BYTES do recado, calibrado para `BIBLO_VOICE_MAX_MS` (60s).
 *
 * **Não é o teto real de duração, é o backstop dele.** O cliente ENCERRA a
 * gravação sozinho ao alcançar o teto de tempo; decodificar o áudio aqui para
 * medir a duração de verdade exigiria um binário que este runtime não tem.
 * 2 MB cobre 60s a ~270 kbps, bem acima do que qualquer navegador produz para
 * voz (o gravador principal pede 24 kbps; ver `AUDIO_CONSTRAINTS`) — a folga é
 * de propósito, porque `audioBitsPerSecond` é pedido, não garantia, mesma
 * lição de `reportTrackSettings`.
 */
const MAX_VOICE_FILE_BYTES = 2 * 1024 * 1024;
/** Grace sobre `BIBLO_VOICE_MAX_MS`, para o tempo entre "alcançou o teto" e "parou de fato". */
const DURATION_GRACE_MS = 5_000;

/**
 * POST /api/biblo/voice — um recado falado, um texto de volta.
 *
 * **Não escreve na conversa.** Quem grava a mensagem de verdade continua
 * sendo `POST /api/biblo`, quando a pessoa envia o texto que voltou aqui —
 * ver o cabeçalho de `BIBLO_VOICE_MAX_MS` em `lib/domain/biblo.ts`.
 *
 * A ordem: `auth → cadência → dono da sessão → arquivo válido → allowance →
 * COBRA → transcreve`. Cobrar antes de chamar a OpenAI é a mesma decisão de
 * `POST /api/biblo`: o débito não volta se o upstream falhar depois.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["biblo-voice"], auth.user.id);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid multipart body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const sessionIdRaw = form.get("sessionId");
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw.trim() : "";
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }

  // A RLS é o dono da resposta: uma sessão de outra pessoa simplesmente não
  // volta desta leitura. Confere ANTES do trabalho caro, mesma regra de
  // `POST /api/biblo`.
  const session = await getSessionView(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_VOICE_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  // O balde de BYTES por hora é o mesmo de `/api/transcribe`
  // (`transcribe:bytes:user:<id>`), de propósito: os dois são STT sobre a
  // mesma conta OpenAI, e um orçamento por rota deixaria alguém dobrar o
  // teto real gravando sermão pela metade e recados pela outra.
  const overBudget = enforceAudioBudget(auth.user.id, file.size);
  if (overBudget) return overBudget;

  const extension = ((form.get("extension") as string | null) ?? "webm").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
  }
  const durationMsRaw = form.get("durationMs");
  const durationMs = typeof durationMsRaw === "string" ? Number.parseFloat(durationMsRaw) : NaN;
  if (Number.isFinite(durationMs) && durationMs > BIBLO_VOICE_MAX_MS + DURATION_GRACE_MS) {
    return NextResponse.json({ error: "recording too long" }, { status: 422 });
  }
  const audioSeconds =
    Number.isFinite(durationMs) && durationMs > 0
      ? Math.min(durationMs, BIBLO_VOICE_MAX_MS + DURATION_GRACE_MS) / 1000
      : 0;

  const allowance = await resolveBibloVoiceAllowance();
  if (allowance.kind === "denied") {
    const body: BibloVoiceTurn = {
      ok: false,
      error: "biblo_voice_not_available",
      reason: allowance.reason,
    };
    return NextResponse.json(body, {
      status: allowance.reason === "insufficient_balance" ? 402 : 403,
    });
  }

  const charge = await chargeCoins("biblo_voice_message", sessionId, auth.user.id);
  if (!charge.ok) {
    if (charge.error === "insufficient_balance") {
      const body: BibloVoiceTurn = {
        ok: false,
        error: "biblo_voice_not_available",
        reason: "insufficient_balance",
      };
      return NextResponse.json(body, { status: 402 });
    }
    log.error("charge failed", { error: charge.error, message: charge.message });
    return NextResponse.json({ error: "charge_failed" }, { status: 500 });
  }

  const model = serverEnv.OPENAI_TRANSCRIBE_MODEL;
  const result = await callTranscribe({
    model,
    file,
    filename: `voice.${extension}`,
    language: "pt",
  });

  if (!result.ok) {
    // A moeda JÁ foi cobrada e não é estornada (ver `bibloVoiceMessage` em
    // `features/coins/pricing.ts`): sete moedas não pagam a complexidade de um
    // estorno, mesma decisão de `POST /api/biblo` para o modelo de texto.
    log.error("transcrição falhou", {
      kind: result.error.kind,
      message: result.error.message,
    });
    return NextResponse.json({ ok: false, error: "voice_failed" }, { status: 502 });
  }

  await recordAudioUsage({
    userId: auth.user.id,
    sessionId,
    route: "biblo-voice",
    model,
    audioSeconds,
    latencyMs: result.data.latencyMs,
  });

  const text = result.data.text.trim();
  if (!text) {
    // Sem alucinação segura aqui: o áudio pode simplesmente ter vindo em
    // silêncio. `ok: false` sem denial nenhum, o campo continua vazio.
    return NextResponse.json({ ok: false, error: "empty_transcription" }, { status: 200 });
  }

  const body: BibloVoiceTurn = { ok: true, text, balance: charge.balance };
  return NextResponse.json(body);
}
