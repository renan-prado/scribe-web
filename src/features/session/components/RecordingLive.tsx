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
import { Feed } from "@/features/session/components/Feed";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { HiddenTabOverlay } from "@/features/session/components/HiddenTabOverlay";
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
} from "@/features/session/config";
import { useBiblePipeline } from "@/features/session/hooks/useBiblePipeline";
import { useCoinTick } from "@/features/session/hooks/useCoinTick";
import { useDrainTimer } from "@/features/session/hooks/useDrainTimer";
import { useEchoPipeline } from "@/features/session/hooks/useEchoPipeline";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useInsightsPipeline } from "@/features/session/hooks/useInsightsPipeline";
import { useVersePrefetcher } from "@/features/session/hooks/useVerseFetch";
import { useVisibilityWarning } from "@/features/session/hooks/useVisibilityWarning";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import { requestFinalSummary, uploadChunkWithRetry } from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { tailSentences } from "@/features/session/lib/text";
import type { ChunkRow, TranscriptState } from "@/features/session/types";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { devLog } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";
import { getSessionState, useSessionStore } from "@/lib/stores/session";
import { cn } from "@/lib/utils";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const autoStartFiredRef = useRef(false);

  // ---- store subscriptions ----
  const running = useSessionStore((s) => s.running);
  const finalizing = useSessionStore((s) => s.finalizing);
  const saved = useSessionStore((s) => s.saved);
  const startupError = useSessionStore((s) => s.startupError);
  const recordingStartedAt = useSessionStore((s) => s.recordingStartedAt);
  const chunks = useSessionStore((s) => s.chunks);
  const feedItems = useSessionStore((s) => s.feedItems);
  const summary = useSessionStore((s) => s.summary);
  const summaryTitle = useSessionStore((s) => s.summaryTitle);
  const speakerName = useSessionStore((s) => s.speakerName);
  const speakerLocation = useSessionStore((s) => s.speakerLocation);
  const insightsInFlight = useSessionStore((s) => s.insightsInFlight);
  const autoFollow = useSessionStore((s) => s.autoFollow);
  const pendingNew = useSessionStore((s) => s.pendingNew);

  // ---- ui-local state (dialog open flags) ----
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [liveFeedOpen, setLiveFeedOpen] = useState(false);

  const elapsedMs = useElapsedTimer(running, startedAtRef);
  useWakeLock({ enabled: running });
  const { warning: hiddenWarning, dismiss: dismissHiddenWarning } = useVisibilityWarning({
    enabled: running,
  });
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

  const transcript = useMemo(() => {
    return chunkRows
      .filter((r) => r.status === "ok")
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }, [chunkRows]);

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

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

      const currentChunks = useSessionStore.getState().chunks;
      const previousText = Object.values(currentChunks)
        .filter((r) => r.index < ev.index && r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text)
        .join(" ");
      const prevHint = tailSentences(previousText, 2);

      const result = await uploadChunkWithRetry(ev, prevHint, sessionId);
      const current = useSessionStore.getState().chunks[ev.index];
      if (!current) return;
      if (result.ok) {
        useSessionStore.getState().upsertChunk({ ...current, status: "ok", text: result.text });
      } else {
        useSessionStore.getState().upsertChunk({ ...current, status: "error" });
      }
    },
    [sessionId]
  );

  const start = useCallback(async () => {
    if (getSessionState().running) return;

    getSessionState().reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    getSessionState().setRecordingStartedAt(new Date());

    cancelDrainTimer();

    const rec = createRecorder({
      minChunkMs: RECORDER_MIN_CHUNK_MS,
      maxChunkMs: RECORDER_MAX_CHUNK_MS,
      silenceThreshold: RECORDER_SILENCE_THRESHOLD,
      silenceHoldMs: RECORDER_SILENCE_HOLD_MS,
    });
    rec.onChunk(handleChunk);

    try {
      await rec.start();
      recorderRef.current = rec;
      // startedAtRef MUST be seeded before setRunning(true) so useElapsedTimer
      // observes a valid origin on first render — see AGENTS.md guardrails.
      startedAtRef.current = performance.now();
      getSessionState().setRunning(true);
      devLog("[session] start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      getSessionState().setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, sessionId, initialSpeakerName, initialSpeakerLocation, cancelDrainTimer]);

  const stop = useCallback(async () => {
    const s = getSessionState();
    if (!s.running) return;
    const durationMs = Math.round(performance.now() - startedAtRef.current);
    devLog("[session] stop", {
      sessionId,
      at: new Date().toISOString(),
      durationMs,
      ...s.counters,
    });
    s.setRunning(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    const finalTranscript = Object.values(getSessionState().chunks)
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!finalTranscript) return;

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
  }, [router, sessionId]);

  // Coin billing: 10 moedas/min (per started minute). First tick fires
  // immediately so t=0 is billed; subsequent ticks every 60s. On depletion
  // we call stop() so the pipeline finalizes what was captured so far
  // instead of leaving the recorder running with no budget behind it.
  useCoinTick({
    enabled: running,
    reason: "live_minute",
    sessionId,
    onDepleted: () => {
      toast.warning("Saldo de moedas esgotado.", {
        description: "Gravação finalizada automaticamente.",
      });
      void stop();
    },
  });

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
      devLog("[session] rollup", { at: `${m}:${s}`, ...c });
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

  const handleTitleChange = useCallback((v: string) => {
    getSessionState().setSummaryTitle(v);
  }, []);
  const handleTitleLock = useCallback(() => {
    getSessionState().lockTitle();
  }, []);
  const handleSpeakerNameChange = useCallback((v: string) => {
    getSessionState().setSpeakerName(v);
  }, []);
  const handleSpeakerLocationChange = useCallback((v: string) => {
    getSessionState().setSpeakerLocation(v);
  }, []);

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
      {running ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <RecordButton
            running={running}
            elapsedMs={elapsedMs}
            onStart={start}
            onStop={stop}
            compact
          />
        </div>
      ) : null}
      {running && !autoFollow && pendingNew > 0 ? (
        <button
          type="button"
          onClick={resumeAutoFollow}
          className={cn(
            "fixed bottom-24 left-1/2 z-40 -translate-x-1/2",
            "inline-flex items-center gap-2 rounded-full border border-[color:var(--scriba-hairline)] bg-white/95 px-4 py-2 shadow-lg backdrop-blur",
            "text-xs font-semibold text-[color:var(--scriba-ink)]",
            "transition-colors outline-none hover:bg-[color:var(--scriba-blue-soft)]/60 focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          Ler novidades
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--scriba-blue)] px-1.5 text-[0.65rem] font-bold text-white">
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
        <section className="relative flex w-full min-h-[280px] self-stretch flex-col gap-6 pb-32 sm:p-6 sm:pb-32">
          <RecordingHeader
            title={summaryTitle}
            startedAt={recordingStartedAt}
            speakerName={speakerName}
            speakerLocation={speakerLocation}
            onTitleChange={handleTitleChange}
            onTitleLock={handleTitleLock}
            onSpeakerNameChange={handleSpeakerNameChange}
            onSpeakerLocationChange={handleSpeakerLocationChange}
            saved={saved}
            menu={
              <SessionMenu
                hasTranscript={transcript.length > 0}
                hasLiveFeed={feedItems.length > 0}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onOpenLiveFeed={() => setLiveFeedOpen(true)}
              />
            }
          />
          <div className="h-px w-full bg-[color:var(--scriba-hairline)]" />
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

          {hiddenWarning && running ? <HiddenTabOverlay onDismiss={dismissHiddenWarning} /> : null}
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
