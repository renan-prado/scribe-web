"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { LiveTranscriptStream } from "@/features/session/components/LiveTranscriptStream";
import { PausedOverlay } from "@/features/session/components/PausedOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { RecordingHeader } from "@/features/session/components/RecordingHeader";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import {
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
  TRANSCRIBE_ESCALATION_BAD_COUNT,
  TRANSCRIBE_ESCALATION_WINDOW,
} from "@/features/session/config";
import { useBackgroundKeepalive } from "@/features/session/hooks/useBackgroundKeepalive";
import { useCoinGuard } from "@/features/session/hooks/useCoinGuard";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useTranscribeQueue } from "@/features/session/hooks/useTranscribeQueue";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import { requestDeleteSession, requestSaveTranscript } from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { joinOkChunks, shouldEscalateTranscription } from "@/features/session/lib/chunks";
import { notifyCoinsRecovered, warnLowCoins } from "@/features/session/lib/coinToasts";
import { defaultRecordingTitle } from "@/features/session/lib/formatting";
import { tailSentences } from "@/features/session/lib/text";
import { normalizeLocationInput, normalizeSpeakerInput } from "@/features/session/lib/unknown";
import { getSessionState, useSessionStore } from "@/features/session/store";
import type { ChunkRow } from "@/features/session/types";
import { COIN_COSTS } from "@/lib/coins/pricing";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { devLog } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

/** Distância do fim da página abaixo da qual o autoscroll continua ligado. */
const AUTO_FOLLOW_BOTTOM_PX = 160;

type Props = {
  /** A linha já existe no Supabase — este componente só faz UPDATE no stop. */
  sessionId: string;
  initialSpeakerName: string;
  initialSpeakerLocation: string;
  /** Entrou pelo diálogo de nova gravação com autostart=1. */
  autoStart?: boolean;
};

/**
 * Modo transcrição: o mesmo backbone de captura/transcrição dos outros modos,
 * mas SEM nenhuma chamada de LLM além do /api/transcribe — sem bible, sem
 * insights, sem echo e sem resumo final. Em troca, o que nos outros modos fica
 * escondido num dialog vira a tela inteira: cada chunk aparece assim que volta
 * transcrito.
 *
 * No stop o texto vai direto pro banco por PUT /api/sessions/:id/transcript e o
 * usuário cai na página de leitura da transcrição. `final_summary` fica null, e
 * é isso que marca a sessão como "só transcrição" no resto do app.
 *
 * Usa o session store (e não refs locais como o RecordingAudioOnly) porque
 * precisa do RecordingHeader — título/autor/local editáveis durante a gravação,
 * que aqui são os ÚNICOS metadados que a sessão vai ter: não existe LLM pra
 * inventar um título depois.
 */
export function RecordingTranscribe({
  sessionId,
  initialSpeakerName,
  initialSpeakerLocation,
  autoStart = false,
}: Props) {
  const router = useRouter();

  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef<number>(0);
  /** Elapsed ativo congelado no instante do pause; re-ancora startedAtRef no
   * resume pra o tempo pausado não contar. */
  const pausedElapsedRef = useRef<number>(0);
  /** Índice do próximo chunk que o gravador criado no resume deve usar. */
  const nextChunkIndexRef = useRef<number>(0);
  const autoStartFiredRef = useRef(false);
  /** Duração medida no stop. Guardada porque o save pode ser repetido pelo
   * botão de retry, e a duração não pode mudar entre as tentativas. */
  const finalDurationRef = useRef<number | null>(null);

  const running = useSessionStore((s) => s.running);
  const paused = useSessionStore((s) => s.paused);
  const finalizing = useSessionStore((s) => s.finalizing);
  const startupError = useSessionStore((s) => s.startupError);
  const chunks = useSessionStore((s) => s.chunks);
  const transcribeTier = useSessionStore((s) => s.transcribeTier);

  const [reportOpen, setReportOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  /** O stop rodou mas o PUT falhou: o texto está só na tela. */
  const [saveFailed, setSaveFailed] = useState(false);

  const activelyRecording = running && !paused;
  const elapsedMs = useElapsedTimer(activelyRecording, startedAtRef);
  useWakeLock({ enabled: activelyRecording });

  const chunkRows = useMemo<ChunkRow[]>(
    () => Object.values(chunks).sort((a, b) => a.index - b.index),
    [chunks]
  );
  const transcript = useMemo(() => joinOkChunks(chunks).transcript, [chunks]);

  const transcribeQueue = useTranscribeQueue({
    sessionId,
    onOrphanRecovered: (chunk) => {
      useSessionStore.getState().upsertChunk({
        index: chunk.index,
        status: "uploading",
        text: "",
        startedAtMs: 0,
      });
    },
    onSuccess: (index, text, meta) => {
      const s = useSessionStore.getState();
      const current = s.chunks[index];
      if (!current) return;
      s.upsertChunk({
        ...current,
        status: "ok",
        text,
        suspect: meta.suspect,
        escalated: meta.escalated,
      });
      if (
        s.transcribeTier === "standard" &&
        shouldEscalateTranscription(
          useSessionStore.getState().chunks,
          TRANSCRIBE_ESCALATION_WINDOW,
          TRANSCRIBE_ESCALATION_BAD_COUNT
        )
      ) {
        s.setTranscribeTier("escalated");
        devLog("[session:transcribe] session escalated", { index });
        toast.warning("Áudio com qualidade baixa detectada.", {
          description: "Ativamos um modelo de transcrição mais preciso para os próximos trechos.",
        });
      }
    },
    getTier: () => useSessionStore.getState().transcribeTier,
  });

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      const startedAtMs = Math.max(0, ev.startedAt - startedAtRef.current);
      const row: ChunkRow = { index: ev.index, status: "uploading", text: "", startedAtMs };
      useSessionStore.getState().upsertChunk(row);

      if (await isSilentBlob(ev.blob)) {
        useSessionStore.getState().upsertChunk({ ...row, status: "silence" });
        return;
      }

      // Chunks suspeitos ficam fora do hint: realimentar o Whisper com uma
      // alucinação recém-detectada tende a fazê-la se repetir.
      const currentChunks = useSessionStore.getState().chunks;
      const previousText = Object.values(currentChunks)
        .filter((r) => r.index < ev.index && r.status === "ok" && !r.suspect)
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text)
        .join(" ");

      await transcribeQueue.enqueue({
        index: ev.index,
        blob: ev.blob,
        mimeType: ev.mimeType,
        extension: ev.extension,
        startedAt: ev.startedAt,
        durationMs: ev.durationMs,
        prevText: tailSentences(previousText, 2),
      });
    },
    [transcribeQueue]
  );

  const start = useCallback(async () => {
    if (getSessionState().running) return;

    getSessionState().reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    getSessionState().setRecordingStartedAt(new Date());

    nextChunkIndexRef.current = 0;
    pausedElapsedRef.current = 0;
    setFollow(true);

    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
      startingIndex: 0,
    });
    rec.onChunk(handleChunk);

    try {
      await rec.start();
      recorderRef.current = rec;
      // startedAtRef DEVE ser semeado antes de setRunning(true) — ver
      // guardrails do AGENTS.md.
      startedAtRef.current = performance.now();
      getSessionState().setRunning(true);
      devLog("[session:transcribe] start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      getSessionState().setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId, initialSpeakerName, initialSpeakerLocation]);

  const pause = useCallback(async () => {
    const s = getSessionState();
    if (!s.running || s.paused) return;
    pausedElapsedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    const indices = Object.keys(getSessionState().chunks).map(Number);
    nextChunkIndexRef.current = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    s.setPaused(true);
    await recorderRef.current?.stop();
    recorderRef.current = null;
    devLog("[session:transcribe] pause", {
      sessionId,
      elapsedMs: pausedElapsedRef.current,
      nextChunkIndex: nextChunkIndexRef.current,
    });
  }, [sessionId]);

  const resume = useCallback(async () => {
    const s = getSessionState();
    if (!s.running || !s.paused) return;
    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
      startingIndex: nextChunkIndexRef.current,
    });
    rec.onChunk(handleChunk);
    try {
      await rec.start();
      recorderRef.current = rec;
      startedAtRef.current = performance.now() - pausedElapsedRef.current;
      s.setPaused(false);
      devLog("[session:transcribe] resume", { sessionId, elapsedMs: pausedElapsedRef.current });
    } catch (err) {
      getSessionState().setStartupError((err as Error).message ?? "failed to resume");
    }
  }, [handleChunk, sessionId]);

  /**
   * Grava o texto acumulado. Isolado do `stop` porque é a única coisa entre o
   * usuário e o resultado: se a rede falhar, o botão de tentar de novo chama
   * exatamente isto, com a mesma duração medida no stop original.
   */
  const persistTranscript = useCallback(async () => {
    const cur = getSessionState();
    const finalTranscript = joinOkChunks(cur.chunks).transcript;
    if (!finalTranscript) return false;

    // Sem LLM não há título gerado: vale o que o usuário digitou no header, ou
    // o padrão derivado da data de início.
    const title =
      cur.summaryTitle.trim() || defaultRecordingTitle(cur.recordingStartedAt ?? new Date());

    cur.setFinalizing(true);
    try {
      const result = await requestSaveTranscript({
        sessionId,
        transcript: finalTranscript,
        durationMs: finalDurationRef.current,
        title,
        speakerName: normalizeSpeakerInput(cur.speakerName) || null,
        speakerLocation: normalizeLocationInput(cur.speakerLocation) || null,
      });
      if (result.ok) {
        setSaveFailed(false);
        getSessionState().setSaved(true);
        toast.success("Transcrição salva", { description: title });
        router.replace(`/recording/${sessionId}/transcript`);
        return true;
      }
      devLog("[session:transcribe] save failed", { sessionId, message: result.message });
      setSaveFailed(true);
      toast.error("Não consegui salvar a transcrição.", {
        description:
          "O texto continua nesta tela — toque em “Salvar transcrição” para tentar de novo.",
      });
      return false;
    } finally {
      getSessionState().setFinalizing(false);
    }
  }, [router, sessionId]);

  const stop = useCallback(async () => {
    const s = getSessionState();
    if (!s.running) return;
    const durationMs = s.paused
      ? pausedElapsedRef.current
      : Math.round(performance.now() - startedAtRef.current);
    finalDurationRef.current = durationMs;
    devLog("[session:transcribe] stop", { sessionId, durationMs, wasPaused: s.paused });
    s.setRunning(false);
    s.setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    // Drena a fila antes de salvar — sem isso, chunks ainda em retry ficariam
    // de fora do texto gravado, e aqui não há resumo posterior que pudesse
    // disfarçar o buraco.
    if (transcribeQueue.pendingCount() > 0) {
      s.setFinalizing(true);
      const { drained, pending } = await transcribeQueue.drain(60_000);
      if (!drained && pending > 0) {
        toast.warning(`${pending} trecho(s) ainda não foram transcritos.`, {
          description: "Serão retomados automaticamente quando você abrir esta sessão de novo.",
        });
      }
    }

    if (!joinOkChunks(getSessionState().chunks).transcript) {
      getSessionState().setFinalizing(false);
      toast.warning("Nenhuma fala foi capturada.", { description: "A gravação foi descartada." });
      void requestDeleteSession(sessionId);
      router.replace("/list");
      return;
    }

    await persistTranscript();
  }, [persistTranscript, router, sessionId, transcribeQueue]);

  /** Encerra e joga fora: derruba o gravador, limpa a fila (inclusive os
   * chunks persistidos), apaga a linha da sessão e volta pra lista. */
  const discard = useCallback(async () => {
    const s = getSessionState();
    devLog("[session:transcribe] discard", { sessionId });
    s.setRunning(false);
    s.setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;
    transcribeQueue.clear();
    await requestDeleteSession(sessionId);
    s.reset({ speakerName: initialSpeakerName, speakerLocation: initialSpeakerLocation });
    toast.success("Gravação descartada.");
    router.replace("/list");
  }, [router, sessionId, transcribeQueue, initialSpeakerName, initialSpeakerLocation]);

  // Cobrança: 1 moeda por minuto iniciado — o modo mais barato, já que só paga
  // a transcrição. Ao esgotar, congela em vez de encerrar.
  const coinGuard = useCoinGuard({
    enabled: activelyRecording,
    reason: "transcript_minute",
    sessionId,
    costPerMinute: COIN_COSTS.transcriptMinute,
    onFreeze: () => void pause(),
    onWarn: (minutesLeft, level) => warnLowCoins(minutesLeft, level, () => setBillingOpen(true)),
    onRecovered: notifyCoinsRecovered,
  });

  useBackgroundKeepalive({
    enabled: activelyRecording,
    sessionId,
    label: initialSpeakerName || "Transcrevendo",
    onExternalStop: () => void stop(),
  });
  useUnloadGuard(running || saveFailed);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    void start();
  }, [autoStart, start]);

  // Desliga o autoscroll quando o usuário sobe a página pra reler algo, e
  // religa quando ele volta ao fim.
  useEffect(() => {
    if (!running) return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setFollow(distanceFromBottom <= AUTO_FOLLOW_BOTTOM_PX);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [running]);

  const hasStarted = running || chunkRows.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
      {!hasStarted ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <RecordButton
            running={running}
            elapsedMs={elapsedMs}
            onStart={start}
            onStop={stop}
            autoStarting={autoStart && !running && !startupError}
          />
        </div>
      ) : null}

      {running && !paused ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <RecordButton
            running={running}
            elapsedMs={elapsedMs}
            onStart={start}
            onStop={stop}
            onPause={pause}
            onDiscard={() => setDiscardOpen(true)}
            compact
          />
        </div>
      ) : null}

      {running && paused ? (
        <PausedOverlay
          elapsedMs={elapsedMs}
          onResume={() => void resume()}
          onStop={stop}
          onDiscard={() => setDiscardOpen(true)}
          outOfCoins={coinGuard.outOfCoins}
        />
      ) : null}

      {running && !follow ? (
        <button
          type="button"
          onClick={() => {
            setFollow(true);
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
          }}
          className={cn(
            "fixed bottom-24 left-1/2 z-40 -translate-x-1/2",
            "inline-flex items-center gap-2 rounded-full border border-scriba-hairline bg-scriba-paper/95 px-4 py-2 shadow-lg backdrop-blur",
            "text-xs font-semibold text-scriba-ink outline-none transition-colors",
            "hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          Acompanhar a transcrição
        </button>
      ) : null}

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : null}

      {hasStarted ? (
        <section className="relative flex min-h-70 w-full flex-col gap-6 self-stretch pb-32 sm:p-6 sm:pb-32">
          <RecordingHeader
            menu={
              <SessionMenu
                hasTranscript={false}
                hasLiveFeed={false}
                onOpenTranscript={() => undefined}
                onOpenLiveFeed={() => undefined}
                onReportHallucination={() => setReportOpen(true)}
              />
            }
          />
          <div className="h-px w-full bg-scriba-hairline" />

          {running && transcribeTier === "escalated" ? (
            <div
              role="status"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-semibold">Áudio com qualidade baixa</p>
              <p className="mt-1">
                A transcrição pode conter erros. Ativamos um modelo mais preciso para os próximos
                trechos — se possível, aproxime o aparelho do som. Você pode continuar ou encerrar a
                gravação.
              </p>
            </div>
          ) : null}

          {saveFailed ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-pretty">
                A transcrição ainda não foi salva. Não saia desta tela sem tentar de novo.
              </p>
              <button
                type="button"
                onClick={() => void persistTranscript()}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-4 py-2 text-[13px] font-semibold text-scriba-cta-ink outline-none transition-colors",
                  " focus-visible:ring-4 focus-visible:ring-scriba-blue/30"
                )}
              >
                Salvar transcrição
              </button>
            </div>
          ) : null}

          <LiveTranscriptStream rows={chunkRows} running={running} follow={follow} />
        </section>
      ) : null}

      {finalizing ? (
        <FinalizingOverlay
          title="Salvando a transcrição"
          subtitle="Terminando de transcrever os últimos trechos capturados."
        />
      ) : null}

      <HallucinationReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={sessionId}
        scope="live"
        // Não há feed pra corrigir: a auditoria julga só a transcrição, e o
        // desfecho útil é encerrar ou seguir gravando.
        getLiveContext={() => ({ text: transcript, feedItems: [] })}
        onStopRecording={running ? () => void stop() : undefined}
      />

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar esta gravação?"
        description="Tudo o que foi transcrito até agora será apagado. Esta ação não pode ser desfeita."
        confirmLabel="Descartar"
        pendingLabel="Descartando…"
        onConfirm={discard}
      />
    </main>
  );
}
