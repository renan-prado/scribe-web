"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { ConfirmDialog } from "@/features/session/components/ConfirmDialog";
import { Feed } from "@/features/session/components/Feed";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HallucinationReportDialog } from "@/features/session/components/HallucinationReportDialog";
import { PausedOverlay } from "@/features/session/components/PausedOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { RecordingHeader } from "@/features/session/components/RecordingHeader";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { StatusPhrases } from "@/features/session/components/StatusPhrases";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TranscriptView } from "@/features/session/components/TranscriptView";
import {
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
  TRANSCRIBE_ESCALATION_BAD_COUNT,
  TRANSCRIBE_ESCALATION_WINDOW,
} from "@/features/session/config";
import { useBackgroundKeepalive } from "@/features/session/hooks/useBackgroundKeepalive";
import { useBiblePipeline } from "@/features/session/hooks/useBiblePipeline";
import { useCoinGuard } from "@/features/session/hooks/useCoinGuard";
import { useDrainTimer } from "@/features/session/hooks/useDrainTimer";
import { useEchoPipeline } from "@/features/session/hooks/useEchoPipeline";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useInsightsPipeline } from "@/features/session/hooks/useInsightsPipeline";
import { useTranscribeQueue } from "@/features/session/hooks/useTranscribeQueue";
import { useUnloadGuard } from "@/features/session/hooks/useUnloadGuard";
import { useVersePrefetcher } from "@/features/session/hooks/useVerseFetch";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import { requestDeleteSession, requestFinalSummary } from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { joinOkChunks, shouldEscalateTranscription } from "@/features/session/lib/chunks";
import { notifyCoinsRecovered, warnLowCoins } from "@/features/session/lib/coinToasts";
import { tailSentences } from "@/features/session/lib/text";
import { getSessionState, useSessionStore } from "@/features/session/store";
import type { ChunkRow, TranscriptState } from "@/features/session/types";
import { COIN_COSTS } from "@/lib/coins/pricing";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { createLogger } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

const log = createLogger("session");
const transcribeLog = createLogger("transcribe");

type Props = {
  /** The row already exists in Supabase — this component only UPDATEs it on stop. */
  sessionId: string;
  initialSpeakerName: string;
  initialSpeakerLocation: string;
  /** If true, fire start() once on mount (entry from the "Nova gravação" dialog). */
  autoStart?: boolean;
};

export function RecordingLive({
  sessionId,
  initialSpeakerName,
  initialSpeakerLocation,
  autoStart = false,
}: Props) {
  const router = useRouter();

  // ---- imperative refs (browser resources, mount guards) ----
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef<number>(0);
  /** Active-recording elapsed ms captured the instant we entered pause; used
   * to re-anchor `startedAtRef` on resume so the timer picks up where it
   * stopped (paused time is not counted). */
  const pausedElapsedRef = useRef<number>(0);
  /** Next chunk index to hand to the new recorder created on resume — keeps
   * chunk indices monotonically increasing across pauses so nothing overwrites
   * previously stored transcript rows. */
  const nextChunkIndexRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const autoStartFiredRef = useRef(false);

  // ---- store subscriptions ----
  const running = useSessionStore((s) => s.running);
  const paused = useSessionStore((s) => s.paused);
  const finalizing = useSessionStore((s) => s.finalizing);
  const startupError = useSessionStore((s) => s.startupError);
  const chunks = useSessionStore((s) => s.chunks);
  const feedItems = useSessionStore((s) => s.feedItems);
  const summary = useSessionStore((s) => s.summary);
  const insightsInFlight = useSessionStore((s) => s.insightsInFlight);
  const autoFollow = useSessionStore((s) => s.autoFollow);
  const pendingNew = useSessionStore((s) => s.pendingNew);
  const transcribeTier = useSessionStore((s) => s.transcribeTier);

  // ---- ui-local state (dialog open flags) ----
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [liveFeedOpen, setLiveFeedOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  /** Diálogo de compra aberto sem sair da página — sair mataria o recorder. */
  const [billingOpen, setBillingOpen] = useState(false);

  const activelyRecording = running && !paused;
  const elapsedMs = useElapsedTimer(activelyRecording, startedAtRef);
  useWakeLock({ enabled: activelyRecording });
  const prefetchVerse = useVersePrefetcher();

  // ---- feed drip + three live pipelines ----
  const { scheduleDrainIfIdle, cancel: cancelDrainTimer } = useDrainTimer();

  useBiblePipeline({
    sessionId,
    prefetchVerse,
    scheduleDrainIfIdle,
    startedAtRef,
  });
  useInsightsPipeline({ sessionId, scheduleDrainIfIdle, startedAtRef });
  useEchoPipeline({ sessionId, scheduleDrainIfIdle, startedAtRef });

  // ---- derived views ----
  const chunkRows = useMemo<ChunkRow[]>(
    () => Object.values(chunks).sort((a, b) => a.index - b.index),
    [chunks]
  );

  const transcript = useMemo(() => joinOkChunks(chunks).transcript, [chunks]);

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

  const transcribeQueue = useTranscribeQueue({
    sessionId,
    onOrphanRecovered: (chunk) => {
      // Recovered chunks land at index-order in the transcript. We don't know
      // their original startedAtMs offset (the previous session's clock is
      // gone), so we seed 0 — the transcript view sorts by index anyway.
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
      // Promoção da sessão ao modelo escalado quando o áudio se mostra ruim
      // de forma sustentada. Pegajosa até o fim da sessão; o banner acima do
      // feed avisa o usuário para que ele decida se continua.
      if (
        s.transcribeTier === "standard" &&
        shouldEscalateTranscription(
          useSessionStore.getState().chunks,
          TRANSCRIBE_ESCALATION_WINDOW,
          TRANSCRIBE_ESCALATION_BAD_COUNT
        )
      ) {
        s.setTranscribeTier("escalated");
        transcribeLog.debug("session escalated", { index });
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
      const row: ChunkRow = {
        index: ev.index,
        status: "uploading",
        text: "",
        startedAtMs,
      };
      useSessionStore.getState().upsertChunk(row);

      if (await isSilentBlob(ev.blob)) {
        useSessionStore.getState().upsertChunk({ ...row, status: "silence" });
        return;
      }

      // Chunks suspeitos ficam fora do hint: realimentar o Whisper com uma
      // alucinação recém-detectada tende a fazê-la se repetir no próximo chunk.
      const currentChunks = useSessionStore.getState().chunks;
      const previousText = Object.values(currentChunks)
        .filter((r) => r.index < ev.index && r.status === "ok" && !r.suspect)
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text)
        .join(" ");
      const prevHint = tailSentences(previousText, 2);

      await transcribeQueue.enqueue({
        index: ev.index,
        blob: ev.blob,
        mimeType: ev.mimeType,
        extension: ev.extension,
        startedAt: ev.startedAt,
        durationMs: ev.durationMs,
        prevText: prevHint,
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

    cancelDrainTimer();

    nextChunkIndexRef.current = 0;
    pausedElapsedRef.current = 0;

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
      // startedAtRef MUST be seeded before setRunning(true) so useElapsedTimer
      // observes a valid origin on first render — see AGENTS.md guardrails.
      startedAtRef.current = performance.now();
      getSessionState().setRunning(true);
      log.debug("start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      getSessionState().setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId, initialSpeakerName, initialSpeakerLocation, cancelDrainTimer]);

  const pause = useCallback(async () => {
    const s = getSessionState();
    if (!s.running || s.paused) return;
    // Freeze the elapsed timer at its current value — startedAtRef is now
    // stale and will be re-anchored on resume.
    pausedElapsedRef.current = Math.max(0, performance.now() - startedAtRef.current);
    // Next chunk index the RESUMED recorder should start at. Uses the max
    // of already-stored chunk indices plus one, so the resumed capture never
    // overwrites transcript rows produced before the pause.
    const chunkIndices = Object.keys(getSessionState().chunks).map(Number);
    nextChunkIndexRef.current = chunkIndices.length > 0 ? Math.max(...chunkIndices) + 1 : 0;
    s.setPaused(true);
    // Tearing down the recorder releases the mic (removes the OS "in use"
    // indicator) and stops MediaRecorder from consuming any resources.
    await recorderRef.current?.stop();
    recorderRef.current = null;
    log.debug("pause", {
      sessionId,
      at: new Date().toISOString(),
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
      // Re-anchor timer so elapsed picks up from the paused value.
      startedAtRef.current = performance.now() - pausedElapsedRef.current;
      s.setPaused(false);
      log.debug("resume", {
        sessionId,
        at: new Date().toISOString(),
        elapsedMs: pausedElapsedRef.current,
        nextChunkIndex: nextChunkIndexRef.current,
      });
    } catch (err) {
      getSessionState().setStartupError((err as Error).message ?? "failed to resume");
    }
  }, [handleChunk, sessionId]);

  const stop = useCallback(async () => {
    const s = getSessionState();
    if (!s.running) return;
    // While paused, startedAtRef is stale — use the frozen elapsed instead.
    const durationMs = s.paused
      ? pausedElapsedRef.current
      : Math.round(performance.now() - startedAtRef.current);
    log.debug("stop", {
      sessionId,
      at: new Date().toISOString(),
      durationMs,
      wasPaused: s.paused,
      ...s.counters,
    });
    s.setRunning(false);
    s.setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    // Drain the transcribe queue before running final-summary — without this,
    // chunks still in retry-backoff would be missing from the LLM input and
    // the summary would silently exclude parts of the sermon.
    if (transcribeQueue.pendingCount() > 0) {
      getSessionState().setFinalizing(true);
      const { drained, pending } = await transcribeQueue.drain(60_000);
      if (!drained && pending > 0) {
        toast.warning(`${pending} trecho(s) ainda não foram transcritos.`, {
          description: "Serão retomados automaticamente quando você abrir esta sessão de novo.",
        });
      }
    }

    const finalTranscript = joinOkChunks(getSessionState().chunks).transcript;
    // Empty transcript = the mic was open but nothing intelligible was
    // captured (silence, room noise below VAD, mic muted, etc). Skip the
    // final-summary LLM call and discard the empty session row created
    // up-front by the "Nova gravação" dialog so it doesn't clutter history.
    if (!finalTranscript) {
      getSessionState().setFinalizing(false);
      toast.warning("Nenhuma fala foi capturada.", {
        description: "A gravação foi descartada sem gerar resumo.",
      });
      void requestDeleteSession(sessionId);
      router.replace("/list");
      return;
    }

    const capturedItems = getSessionState().feedItems;
    const capturedSpeakerName = getSessionState().speakerName;
    const capturedSpeakerLocation = getSessionState().speakerLocation;

    getSessionState().setFinalizing(true);
    try {
      const result = await requestFinalSummary({
        sessionId,
        text: finalTranscript,
        feedItems: capturedItems,
        durationMs,
        speakerName: capturedSpeakerName,
        speakerLocation: capturedSpeakerLocation,
      });
      if (result) {
        const cur = getSessionState();
        cur.setSummary(result.payload);
        if (result.payload.title && !cur.titleLockedByUser) {
          cur.setSummaryTitle(result.payload.title);
        }
        if (result.saved) {
          cur.setSaved(true);
          toast.success("Sessão salva", {
            description: result.payload.title || "Resumo disponível no histórico.",
          });
          router.replace(`/recording/${sessionId}/summary`);
        } else {
          toast.error("Resumo pronto, mas o salvamento falhou.", {
            description: "Verifique o log do servidor. Você ainda pode ver o resumo abaixo.",
          });
        }
      }
    } finally {
      getSessionState().setFinalizing(false);
    }
  }, [router, sessionId, transcribeQueue]);

  /**
   * End the recording and throw it away: tear down the recorder, drop the
   * transcribe queue (incl. persisted chunks), delete the session row, and
   * return to the list. No final-summary call. Gated behind ConfirmDialog.
   */
  const discard = useCallback(async () => {
    const s = getSessionState();
    log.debug("discard", { sessionId, at: new Date().toISOString() });
    s.setRunning(false);
    s.setPaused(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;
    cancelDrainTimer();
    transcribeQueue.clear();
    await requestDeleteSession(sessionId);
    s.reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    toast.success("Gravação descartada.");
    router.replace("/list");
  }, [
    router,
    sessionId,
    cancelDrainTimer,
    transcribeQueue,
    initialSpeakerName,
    initialSpeakerLocation,
  ]);

  // Cobrança: `COIN_COSTS.liveMinute` moedas/min iniciado. O primeiro débito sai no t=0; os demais
  // a cada 60s. Ao esgotar, a captura é CONGELADA (pause), não encerrada —
  // o transcript, a fila de chunks e o feed continuam vivos esperando o
  // crédito. Ver `useCoinGuard` para o porquê da mudança.
  const coinGuard = useCoinGuard({
    enabled: activelyRecording,
    reason: "live_minute",
    sessionId,
    costPerMinute: COIN_COSTS.liveMinute,
    onFreeze: () => void pause(),
    onWarn: (minutesLeft, level) => warnLowCoins(minutesLeft, level, () => setBillingOpen(true)),
    onRecovered: notifyCoinsRecovered,
  });

  // Background-recording defenses (silent audio + Media Session + RN bridge)
  // and browser close-confirmation. See hook docs for full rationale.
  useBackgroundKeepalive({
    enabled: activelyRecording,
    sessionId,
    label: initialSpeakerName || "Gravando sermão",
    onExternalStop: () => void stop(),
  });
  useUnloadGuard(running);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
    };
  }, []);

  // Auto-start once on mount when entering from the "Nova gravação" dialog so
  // the user only has to click "Iniciar" one time. Guarded so React strict-mode
  // double-invoke doesn't fire twice.
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    void start();
  }, [autoStart, start]);

  // Session rollup log every 60s while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const elapsedSec = Math.round((performance.now() - startedAtRef.current) / 1000);
      const m = Math.floor(elapsedSec / 60)
        .toString()
        .padStart(2, "0");
      const s = (elapsedSec % 60).toString().padStart(2, "0");
      const c = getSessionState().counters;
      log.debug("rollup", { at: `${m}:${s}`, ...c });
    }, 60_000);
    return () => clearInterval(id);
  }, [running]);

  const hasStarted = running || chunkRows.length > 0;
  const transcriptState: TranscriptState = running
    ? isProcessing
      ? "transcribing"
      : "listening"
    : "idle";

  const AUTO_FOLLOW_BOTTOM_PX = 140;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const resumeAutoFollow = useCallback(() => {
    const s = getSessionState();
    s.setAutoFollow(true);
    s.setSeenItemsLen(s.feedItems.length);
    s.setPendingNew(0);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!running) return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      const atTail = distanceFromBottom <= AUTO_FOLLOW_BOTTOM_PX;
      const s = getSessionState();
      if (atTail !== s.autoFollow) {
        s.setAutoFollow(atTail);
        if (atTail) {
          s.setSeenItemsLen(s.feedItems.length);
          s.setPendingNew(0);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const s = getSessionState();
    if (s.autoFollow) {
      s.setSeenItemsLen(feedItems.length);
      scrollToBottom();
    } else {
      const unseen = Math.max(0, feedItems.length - s.seenItemsLen);
      s.setPendingNew(unseen);
    }
  }, [running, feedItems.length, scrollToBottom]);

  return (
    <main className="mx-auto flex flex-1 w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
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
      {/* O `env()` soma o indicador de início do iPhone: no PWA instalado o app
          desenha até a borda física da tela (`viewport-fit=cover`), e um
          `bottom-6` seco deixaria o botão de parar por baixo da barra do gesto
          do sistema. Em qualquer outro aparelho o inset é 0. */}
      {running && !paused ? (
        <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2">
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
      {running && !autoFollow && pendingNew > 0 ? (
        <button
          type="button"
          onClick={resumeAutoFollow}
          className={cn(
            "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2",
            "inline-flex items-center gap-2 rounded-full border border-scriba-hairline bg-scriba-paper/95 px-4 py-2 shadow-lg backdrop-blur",
            "text-xs font-semibold text-scriba-ink",
            "transition-colors outline-none hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          Ler novidades
          <span className="inline-flex min-w-5 items-center justify-center rounded-full scriba-cta bg-[image:var(--scriba-cta)] px-1.5 text-[0.65rem] font-bold text-scriba-cta-ink">
            {pendingNew}
          </span>
        </button>
      ) : null}

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : null}

      {hasStarted ? (
        <section className="relative flex w-full min-h-70 self-stretch flex-col gap-6 pb-32 sm:p-6 sm:pb-32">
          <RecordingHeader
            menu={
              <SessionMenu
                hasTranscript={transcript.length > 0}
                hasLiveFeed={feedItems.length > 0}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onOpenLiveFeed={() => setLiveFeedOpen(true)}
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
                trechos — se possível, aproxime o aparelho do som ou verifique o microfone. Você
                pode continuar ou encerrar a gravação.
              </p>
            </div>
          ) : null}
          <div className="flex-1">
            {running || (!summary && !finalizing) ? (
              <Feed
                items={feedItems}
                running={running}
                hasTranscript={transcript.length > 0}
                suggesting={insightsInFlight}
              />
            ) : (
              <SummaryView
                summary={summary}
                hasTranscript={transcript.length > 0}
                running={running}
              />
            )}
          </div>
          {running ? (
            <div ref={bottomRef} className="pt-2 scroll-mb-24">
              <StatusPhrases hasSummary={feedItems.length > 0} />
            </div>
          ) : null}

          {finalizing ? <FinalizingOverlay /> : null}
        </section>
      ) : null}

      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transcrição</DialogTitle>
            <DialogDescription>Texto bruto capturado pelo microfone.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <TranscriptView rows={chunkRows} state={transcriptState} />
          </div>
        </DialogContent>
      </Dialog>

      <HallucinationReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={sessionId}
        scope="live"
        getLiveContext={() => {
          const s = getSessionState();
          return { text: joinOkChunks(s.chunks).transcript, feedItems: s.feedItems };
        }}
        onRemoveKeys={(keys) => getSessionState().removeFeedItemsByKey(keys)}
        onStopRecording={running ? () => void stop() : undefined}
      />

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar esta gravação?"
        description="Tudo o que foi capturado até agora será apagado e nenhum resumo será gerado. Esta ação não pode ser desfeita."
        confirmLabel="Descartar"
        pendingLabel="Descartando…"
        onConfirm={discard}
      />

      <Dialog open={liveFeedOpen} onOpenChange={setLiveFeedOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conteúdo do live</DialogTitle>
            <DialogDescription>
              Cartões extraídos e sugestões que apareceram durante a gravação.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <Feed
              items={feedItems}
              running={false}
              hasTranscript={transcript.length > 0}
              suggesting={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
