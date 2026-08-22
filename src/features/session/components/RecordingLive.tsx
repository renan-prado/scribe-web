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
  BIBLE_MIN_TAIL_DELTA_CHARS,
  BIBLE_TRANSCRIPT_CHARS,
  ECHO_MIN_TAIL_DELTA_CHARS,
  FEED_MIN_GAP_MS,
  INSIGHTS_INTERVAL_MS,
  INSIGHTS_MIN_TAIL_DELTA_CHARS,
  INSIGHTS_QUEUE_BACKPRESSURE,
  INSIGHTS_TRANSCRIPT_CHARS,
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MAX_CHUNK_MS_READING,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS_READING,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
} from "@/features/session/config";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { useTranslation } from "@/features/session/hooks/useTranslation";
import { useVersePrefetcher } from "@/features/session/hooks/useVerseFetch";
import { useVisibilityWarning } from "@/features/session/hooks/useVisibilityWarning";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import {
  requestBible,
  requestEcho,
  requestFinalSummary,
  requestInsights,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { tailSentences, tailTranscript } from "@/features/session/lib/text";
import type { ChunkRow, TranscriptState } from "@/features/session/types";
import { hasBibleMention } from "@/lib/bible/detect";
import { feedItemOrigin } from "@/lib/domain/feed";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import { devLog } from "@/lib/log";
import { createRecorder } from "@/lib/recorder";
import { usePreferencesStore } from "@/lib/stores/preferences";
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
  const insightsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const autoStartFiredRef = useRef(false);

  // ---- store selectors (subscribe) ----
  const running = useSessionStore((s) => s.running);
  const finalizing = useSessionStore((s) => s.finalizing);
  const saved = useSessionStore((s) => s.saved);
  const startupError = useSessionStore((s) => s.startupError);
  const recordingStartedAt = useSessionStore((s) => s.recordingStartedAt);
  const chunks = useSessionStore((s) => s.chunks);
  const feedItems = useSessionStore((s) => s.feedItems);
  const thinking = useSessionStore((s) => s.thinking);
  const readingMode = useSessionStore((s) => s.readingMode);
  const summary = useSessionStore((s) => s.summary);
  const summaryTitle = useSessionStore((s) => s.summaryTitle);
  const speakerName = useSessionStore((s) => s.speakerName);
  const speakerLocation = useSessionStore((s) => s.speakerLocation);
  const bibleInFlight = useSessionStore((s) => s.bibleInFlight);
  const insightsInFlight = useSessionStore((s) => s.insightsInFlight);
  const autoFollow = useSessionStore((s) => s.autoFollow);
  const pendingNew = useSessionStore((s) => s.pendingNew);

  // ---- ui-local state (dialog open flags, hidden-tab warning banner) ----
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [liveFeedOpen, setLiveFeedOpen] = useState(false);

  const elapsedMs = useElapsedTimer(running, startedAtRef);
  useWakeLock({ enabled: running });
  const { warning: hiddenWarning, dismiss: dismissHiddenWarning } = useVisibilityWarning({
    enabled: running,
  });
  const { setAuto: setAutoTranslation, effective: translation } = useTranslation();
  const prefetchVerse = useVersePrefetcher();

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

  const okChunkCount = useMemo(
    () => chunkRows.filter((r) => r.status === "ok").length,
    [chunkRows]
  );

  const isProcessing = useMemo(() => chunkRows.some((r) => r.status === "uploading"), [chunkRows]);

  // ---- drip drain timer ----
  const drainOne = useCallback(() => {
    drainTimerRef.current = null;
    const { drained, hasMore, deferred } = useSessionStore.getState().drainOne();
    // While readingMode holds a non-citedVerse card, poll again in FEED_MIN_GAP_MS
    // so the queue resumes as soon as readingMode flips off.
    if (deferred) {
      drainTimerRef.current = setTimeout(drainOne, FEED_MIN_GAP_MS);
      return;
    }
    if (drained && hasMore) {
      drainTimerRef.current = setTimeout(drainOne, FEED_MIN_GAP_MS);
    }
  }, []);

  const scheduleDrainIfIdle = useCallback(() => {
    if (drainTimerRef.current !== null) return;
    const lastAppendedAt = useSessionStore.getState().lastAppendedAt;
    const elapsed = Date.now() - lastAppendedAt;
    const delay = Math.max(0, FEED_MIN_GAP_MS - elapsed);
    drainTimerRef.current = setTimeout(drainOne, delay);
  }, [drainOne]);

  // Fluxo BIBLE: dispara em cada novo chunk quando (a) o regex-gate encontra
  // menção bíblica na janela recente OU (b) já estamos em readingMode (pra que
  // o card da passagem continue expandindo enquanto o pastor lê versos além
  // da faixa já emitida, mesmo sem repetir o nome do livro no chunk atual).
  useEffect(() => {
    if (!running || bibleInFlight || finalizing) return;
    if (okChunkCount === 0) return;
    const recent = tailTranscript(transcript, BIBLE_TRANSCRIPT_CHARS);
    if (!recent) return;
    const store = useSessionStore.getState();
    const delta = transcript.length - store.lastBibleTailLen;
    if (store.lastBibleTailLen > 0 && delta < BIBLE_MIN_TAIL_DELTA_CHARS) return;
    const inReading = store.readingMode;
    if (!inReading && !hasBibleMention(recent)) {
      store.bumpCounter("bibleGateSkipped");
      return;
    }
    store.setLastBibleTailLen(transcript.length);
    store.setBibleInFlight(true);
    store.bumpCounter("bibleCalls");
    const bibleSermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestBible({
      text: recent,
      existingItems: feedItems,
      sermonAtMs: bibleSermonAtMs,
      sessionId,
    })
      .then(({ items, thinking: nextThinking, readingMode: nextReadingMode, translationHint }) => {
        const s = useSessionStore.getState();
        s.bumpCounter("bibleYield", items.length);
        for (const item of items) {
          if (item.kind === "citedVerse" && !item.text && item.reference.includes(":")) {
            prefetchVerse(item.reference, translation);
          }
        }
        const { hasDripAdd } = s.enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
        if (nextThinking) s.setThinking(nextThinking);
        s.setReadingMode(nextReadingMode);
        if (nextReadingMode !== readingMode) {
          devLog("[feed] readingMode →", nextReadingMode);
        }
        if (translationHint) setAutoTranslation(translationHint);
      })
      .finally(() => useSessionStore.getState().setBibleInFlight(false));
  }, [
    running,
    okChunkCount,
    transcript,
    bibleInFlight,
    finalizing,
    feedItems,
    readingMode,
    translation,
    setAutoTranslation,
    sessionId,
    prefetchVerse,
    scheduleDrainIfIdle,
  ]);

  // Fluxo INSIGHTS: setInterval tempo-based (INSIGHTS_INTERVAL_MS). Pausa
  // enquanto readingMode=true. Gates internos: warmup + delta de transcrição.
  //
  // insightsInFlight NÃO entra nos deps — se entrasse, cada resposta disparava
  // cleanup+recreate do setInterval, reiniciando o relógio de 45s a cada
  // chamada e cortando ~metade das chamadas por sessão. Lemos via getSessionState().
  useEffect(() => {
    if (!running || finalizing) return;
    const tick = () => {
      const s = useSessionStore.getState();
      if (s.insightsInFlight) return;
      if (s.readingMode) return;
      // Backpressure: se a fila de drip já tem items suficientes esperando pra
      // aparecer, não faz sentido gerar mais.
      const pending = s.dripQueue.length;
      if (pending >= INSIGHTS_QUEUE_BACKPRESSURE) {
        s.bumpCounter("skippedBackpressure");
        devLog("[insights] skip", { reason: "queue-backpressure", pending });
        return;
      }
      const currentTranscript = Object.values(s.chunks)
        .filter((r) => r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!currentTranscript) return;
      const recent = tailTranscript(currentTranscript, INSIGHTS_TRANSCRIPT_CHARS);
      const delta = currentTranscript.length - s.lastInsightsTailLen;
      if (s.lastInsightsTailLen > 0 && delta < INSIGHTS_MIN_TAIL_DELTA_CHARS) {
        s.bumpCounter("skippedDelta");
        devLog("[insights] skip", { reason: "tail-delta", delta, tailLen: recent.length });
        return;
      }
      s.setLastInsightsTailLen(currentTranscript.length);
      s.setInsightsInFlight(true);
      s.bumpCounter("insightsCalls");
      const sermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
      void requestInsights({
        text: recent,
        existingItems: s.feedItems,
        sermonAtMs,
        sessionId,
      })
        .then((items) => {
          const cur = useSessionStore.getState();
          cur.bumpCounter("insightsYield", items.length);
          const { hasDripAdd } = cur.enqueueFeedItems(items);
          if (hasDripAdd) scheduleDrainIfIdle();
        })
        .finally(() => {
          useSessionStore.getState().setInsightsInFlight(false);
        });
    };
    const id = setInterval(tick, INSIGHTS_INTERVAL_MS);
    insightsIntervalRef.current = id;
    return () => {
      clearInterval(id);
      insightsIntervalRef.current = null;
    };
  }, [running, finalizing, sessionId, scheduleDrainIfIdle]);

  // Fluxo ECHO: dispara quando o feed acumula ai-streak >= aiStreakThreshold.
  // A frase repetida do pregador quebra o padrão visual de cards da IA.
  useEffect(() => {
    if (!running || finalizing) return;
    const s = useSessionStore.getState();
    if (s.readingMode) return;
    const last = feedItems[feedItems.length - 1];
    if (s.echoing && last?.kind === "speakerEcho") {
      s.setEchoing(false);
      s.rerollEchoThreshold();
    }
    if (useSessionStore.getState().echoing) return;

    let streak = 0;
    for (let i = feedItems.length - 1; i >= 0; i--) {
      if (feedItemOrigin(feedItems[i]) === "ai") streak++;
      else break;
    }
    if (streak < useSessionStore.getState().aiStreakThreshold) return;

    const recent = tailTranscript(transcript, INSIGHTS_TRANSCRIPT_CHARS);
    if (!recent) return;
    const delta = transcript.length - useSessionStore.getState().lastEchoTailLen;
    if (useSessionStore.getState().lastEchoTailLen > 0 && delta < ECHO_MIN_TAIL_DELTA_CHARS) {
      return;
    }

    useSessionStore.getState().setLastEchoTailLen(transcript.length);
    useSessionStore.getState().setEchoing(true);
    const sermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    devLog("[echo] fire", {
      streak,
      threshold: useSessionStore.getState().aiStreakThreshold,
    });
    void requestEcho({ text: recent, existingItems: feedItems, sermonAtMs, sessionId })
      .then((items) => {
        if (items.length === 0) {
          useSessionStore.getState().setEchoing(false);
          return;
        }
        const { hasDripAdd } = useSessionStore.getState().enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
      })
      .catch(() => {
        useSessionStore.getState().setEchoing(false);
      });
  }, [feedItems, running, finalizing, transcript, sessionId, scheduleDrainIfIdle]);

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

    // Preserve pre-Zustand semantics: each session starts with a fresh auto so
    // stale detection from a previous recording doesn't leak into this one.
    usePreferencesStore.getState().resetTranslationAuto();

    getSessionState().reset({
      speakerName: initialSpeakerName,
      speakerLocation: initialSpeakerLocation,
    });
    getSessionState().setRecordingStartedAt(new Date());

    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }

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
  }, [handleChunk, sessionId, initialSpeakerName, initialSpeakerLocation]);

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

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (insightsIntervalRef.current) clearInterval(insightsIntervalRef.current);
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

  // React to readingMode transitions: adjust recorder chunk timing and purge
  // stale echoes from the drip queue when entering reading mode.
  useEffect(() => {
    if (readingMode) {
      getSessionState().purgeEchoFromDripQueue();
    }
    const rec = recorderRef.current;
    if (!rec || !running) return;
    if (readingMode) {
      rec.setChunkTiming({
        minChunkMs: RECORDER_MIN_CHUNK_MS_READING,
        maxChunkMs: RECORDER_MAX_CHUNK_MS_READING,
      });
    } else {
      rec.setChunkTiming({
        minChunkMs: RECORDER_MIN_CHUNK_MS,
        maxChunkMs: RECORDER_MAX_CHUNK_MS,
      });
    }
  }, [readingMode, running]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: feedItems.length + thinking are intentional change-triggers
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
  }, [running, feedItems.length, thinking, scrollToBottom]);

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
    <main className="mx-auto flex flex-1 w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
      {!hasStarted ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />
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
            "inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur",
            "text-xs font-semibold text-foreground/85",
            "transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          Ler novidades
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[0.65rem] font-bold text-background">
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
          <div className="h-px w-full bg-border" />
          <div className="flex-1">
            {running || (!summary && !finalizing) ? (
              <Feed
                items={feedItems}
                running={running}
                hasTranscript={transcript.length > 0}
                suggesting={insightsInFlight}
                readingMode={readingMode}
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
              <StatusPhrases hasSummary={feedItems.length > 0} thinking={thinking} />
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
              readingMode={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
