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
  ECHO_MIN_TAIL_DELTA_CHARS,
  ECHO_STREAK_MAX,
  ECHO_STREAK_MIN,
  EXTRACT_EVERY_N_CHUNKS,
  EXTRACT_EVERY_N_CHUNKS_READING,
  EXTRACT_MIN_TAIL_DELTA_CHARS,
  FEED_MIN_GAP_MS,
  RECENT_TRANSCRIPT_CHARS,
  RECORDER_MAX_CHUNK_MS,
  RECORDER_MAX_CHUNK_MS_READING,
  RECORDER_MIN_CHUNK_MS,
  RECORDER_MIN_CHUNK_MS_READING,
  RECORDER_SILENCE_HOLD_MS,
  RECORDER_SILENCE_THRESHOLD,
  SUGGEST_EVERY_N_CHUNKS,
  SUGGEST_MIN_TAIL_DELTA_CHARS,
  SUGGEST_WARMUP_CHUNKS,
} from "@/features/session/config";
import { useElapsedTimer } from "@/features/session/hooks/useElapsedTimer";
import { TranslationProvider, useTranslation } from "@/features/session/hooks/useTranslation";
import { prefetchVerse } from "@/features/session/hooks/useVerseFetch";
import { useVisibilityWarning } from "@/features/session/hooks/useVisibilityWarning";
import { useWakeLock } from "@/features/session/hooks/useWakeLock";
import {
  requestEcho,
  requestExtract,
  requestFinalSummary,
  requestSuggest,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { tailSentences, tailTranscript } from "@/features/session/lib/text";
import type { ChunkRow, TranscriptState } from "@/features/session/types";
import {
  type FeedItem,
  feedItemDedupKey,
  feedItemOrigin,
  referenceStrictlyContains,
} from "@/lib/domain/feed";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

type Props = {
  /** The row already exists in Supabase — this component only UPDATEs it on stop. */
  sessionId: string;
  initialSpeakerName: string;
  initialSpeakerLocation: string;
  /** If true, fire start() once on mount (typical entry from /spike). */
  autoStart?: boolean;
};

export function RecordingLive(props: Props) {
  return (
    <TranslationProvider>
      <RecordingLiveInner {...props} />
    </TranslationProvider>
  );
}

/**
 * Uniformly sort a fresh echo threshold in [ECHO_STREAK_MIN, ECHO_STREAK_MAX].
 * Re-sorted every time an echo actually reveals so the cadence between echoes
 * doesn't feel metronomic to the listener.
 */
function pickEchoThreshold(): number {
  const span = ECHO_STREAK_MAX - ECHO_STREAK_MIN + 1;
  return ECHO_STREAK_MIN + Math.floor(Math.random() * span);
}

function RecordingLiveInner({
  sessionId,
  initialSpeakerName,
  initialSpeakerLocation,
  autoStart = false,
}: Props) {
  const router = useRouter();
  const recorderRef = useRef<Recorder | null>(null);
  const chunksRef = useRef<Map<number, ChunkRow>>(new Map());
  const startedAtRef = useRef<number>(0);
  const lastExtractChunkRef = useRef(0);
  const lastSuggestChunkRef = useRef(0);
  const lastExtractTailLenRef = useRef(0);
  const lastSuggestTailLenRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dripQueueRef = useRef<Array<{ item: FeedItem; enqueuedAt: number }>>([]);
  const visibleKeysRef = useRef<Set<string>>(new Set());
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppendedAtRef = useRef(0);

  const sessionCountersRef = useRef({
    extractCalls: 0,
    extractYield: 0,
    suggestCalls: 0,
    suggestYield: 0,
    dedupSuppressed: 0,
    skippedDelta: 0,
  });

  const titleLockedByUserRef = useRef(false);
  const readingModeRef = useRef(false);
  const feedItemsRef = useRef<FeedItem[]>([]);

  const aiStreakThresholdRef = useRef<number>(pickEchoThreshold());
  const echoingRef = useRef(false);
  const lastEchoTailLenRef = useRef(0);

  const autoFollowRef = useRef(true);
  const seenItemsLenRef = useRef(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);

  const [running, setRunning] = useState(false);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [startupError, setStartupError] = useState<string>("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [thinking, setThinking] = useState<string>("");
  const [readingMode, setReadingMode] = useState<boolean>(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [speakerName, setSpeakerName] = useState(initialSpeakerName);
  const [speakerLocation, setSpeakerLocation] = useState(initialSpeakerLocation);
  const [recordingStartedAt, setRecordingStartedAt] = useState<Date | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [liveFeedOpen, setLiveFeedOpen] = useState(false);

  const elapsedMs = useElapsedTimer(running, startedAtRef);
  useWakeLock({ enabled: running });
  const { warning: hiddenWarning, dismiss: dismissHiddenWarning } = useVisibilityWarning({
    enabled: running,
  });
  const { setAuto: setAutoTranslation, effective: translation } = useTranslation();

  const publish = useCallback(() => {
    const rows = Array.from(chunksRef.current.values()).sort((a, b) => a.index - b.index);
    setChunkRows(rows);
  }, []);

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

  const drainOne = useCallback(() => {
    drainTimerRef.current = null;
    const entry = dripQueueRef.current.shift();
    if (!entry) return;
    const { item, enqueuedAt } = entry;
    const key = feedItemDedupKey(item);
    visibleKeysRef.current.add(key);
    const lagMs = Date.now() - enqueuedAt;
    console.log("[feed] +item", {
      kind: item.kind,
      key,
      lagMs,
      at: new Date().toISOString(),
      item,
    });
    setFeedItems((prev) => [...prev, item]);
    lastAppendedAtRef.current = Date.now();
    if (dripQueueRef.current.length > 0) {
      drainTimerRef.current = setTimeout(drainOne, FEED_MIN_GAP_MS);
    }
  }, []);

  const enqueueFeedItems = useCallback(
    (incoming: FeedItem[]) => {
      if (incoming.length === 0) return;
      let anyDripAdded = false;
      const queuedKeys = new Set(dripQueueRef.current.map((e) => feedItemDedupKey(e.item)));
      const now = Date.now();
      const readingModeNow = readingModeRef.current;
      const currentCitedVerses: Array<Extract<FeedItem, { kind: "citedVerse" }>> = [
        ...feedItemsRef.current,
        ...dripQueueRef.current.map((e) => e.item),
      ].filter((i): i is Extract<FeedItem, { kind: "citedVerse" }> => i.kind === "citedVerse");

      for (const item of incoming) {
        const key = feedItemDedupKey(item);
        if (visibleKeysRef.current.has(key)) {
          sessionCountersRef.current.dedupSuppressed++;
          console.log("[feed] dedup-suppressed", {
            kind: item.kind,
            key,
            reason: "already-visible",
          });
          continue;
        }
        if (queuedKeys.has(key)) {
          sessionCountersRef.current.dedupSuppressed++;
          console.log("[feed] dedup-suppressed", {
            kind: item.kind,
            key,
            reason: "already-queued",
          });
          continue;
        }

        if (item.kind === "citedVerse") {
          const coveredBy = currentCitedVerses.find((ex) =>
            referenceStrictlyContains(ex.reference, item.reference)
          );
          if (coveredBy) {
            sessionCountersRef.current.dedupSuppressed++;
            console.log("[feed] dedup-suppressed", {
              kind: item.kind,
              key,
              reason: "covered-by",
              by: coveredBy.reference,
            });
            continue;
          }
          const superseded = currentCitedVerses.filter((ex) =>
            referenceStrictlyContains(item.reference, ex.reference)
          );
          if (superseded.length > 0) {
            const supersededKeys = new Set(superseded.map(feedItemDedupKey));
            for (const k of supersededKeys) {
              visibleKeysRef.current.delete(k);
              queuedKeys.delete(k);
            }
            dripQueueRef.current = dripQueueRef.current.filter(
              (e) => !supersededKeys.has(feedItemDedupKey(e.item))
            );
            setFeedItems((prev) => prev.filter((i) => !supersededKeys.has(feedItemDedupKey(i))));
            for (let i = currentCitedVerses.length - 1; i >= 0; i--) {
              if (supersededKeys.has(feedItemDedupKey(currentCitedVerses[i]))) {
                currentCitedVerses.splice(i, 1);
              }
            }
            console.log("[feed] supersede", {
              newer: item.reference,
              removed: [...supersededKeys],
            });
          }
        }

        if (readingModeNow && item.kind === "citedVerse") {
          visibleKeysRef.current.add(key);
          currentCitedVerses.push(item);
          console.log("[feed] +item (fast)", {
            kind: item.kind,
            key,
            lagMs: 0,
            at: new Date().toISOString(),
            item,
          });
          setFeedItems((prev) => [...prev, item]);
          lastAppendedAtRef.current = Date.now();
          continue;
        }

        queuedKeys.add(key);
        dripQueueRef.current.push({ item, enqueuedAt: now });
        if (item.kind === "citedVerse") currentCitedVerses.push(item);
        anyDripAdded = true;
      }
      if (!anyDripAdded) return;
      if (drainTimerRef.current === null) {
        const elapsed = Date.now() - lastAppendedAtRef.current;
        const delay = Math.max(0, FEED_MIN_GAP_MS - elapsed);
        drainTimerRef.current = setTimeout(drainOne, delay);
      }
    },
    [drainOne]
  );

  useEffect(() => {
    if (!running || extracting || finalizing) return;
    if (okChunkCount === 0) return;
    const extractN = readingModeRef.current
      ? EXTRACT_EVERY_N_CHUNKS_READING
      : EXTRACT_EVERY_N_CHUNKS;
    if (okChunkCount % extractN !== 0) return;
    if (lastExtractChunkRef.current === okChunkCount) return;
    const recent = tailTranscript(transcript, RECENT_TRANSCRIPT_CHARS);
    const delta = transcript.length - lastExtractTailLenRef.current;
    if (lastExtractTailLenRef.current > 0 && delta < EXTRACT_MIN_TAIL_DELTA_CHARS) {
      lastExtractChunkRef.current = okChunkCount;
      sessionCountersRef.current.skippedDelta++;
      console.log("[extract] skip", { reason: "tail-delta", delta, tailLen: recent.length });
      return;
    }
    lastExtractChunkRef.current = okChunkCount;
    lastExtractTailLenRef.current = transcript.length;
    setExtracting(true);
    sessionCountersRef.current.extractCalls++;
    const extractSermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestExtract({
      text: recent,
      existingItems: feedItems,
      sermonAtMs: extractSermonAtMs,
      sessionId,
    })
      .then(({ items, thinking: nextThinking, readingMode: nextReadingMode, translationHint }) => {
        sessionCountersRef.current.extractYield += items.length;
        for (const item of items) {
          if (item.kind === "citedVerse" && !item.text && item.reference.includes(":")) {
            prefetchVerse(item.reference, translation);
          }
        }
        enqueueFeedItems(items);
        if (nextThinking) setThinking(nextThinking);
        setReadingMode(nextReadingMode);
        if (nextReadingMode !== readingMode) {
          console.log("[feed] readingMode →", nextReadingMode);
        }
        if (translationHint) setAutoTranslation(translationHint);
      })
      .finally(() => setExtracting(false));
  }, [
    running,
    okChunkCount,
    transcript,
    extracting,
    finalizing,
    feedItems,
    enqueueFeedItems,
    readingMode,
    translation,
    setAutoTranslation,
    sessionId,
  ]);

  useEffect(() => {
    if (!running || suggesting || finalizing) return;
    if (readingMode) return;
    if (okChunkCount < SUGGEST_WARMUP_CHUNKS) return;
    if (okChunkCount % SUGGEST_EVERY_N_CHUNKS !== 0) return;
    if (lastSuggestChunkRef.current === okChunkCount) return;
    const recent = tailTranscript(transcript, RECENT_TRANSCRIPT_CHARS);
    const delta = transcript.length - lastSuggestTailLenRef.current;
    if (lastSuggestTailLenRef.current > 0 && delta < SUGGEST_MIN_TAIL_DELTA_CHARS) {
      lastSuggestChunkRef.current = okChunkCount;
      sessionCountersRef.current.skippedDelta++;
      console.log("[suggest] skip", { reason: "tail-delta", delta, tailLen: recent.length });
      return;
    }
    lastSuggestChunkRef.current = okChunkCount;
    lastSuggestTailLenRef.current = transcript.length;
    setSuggesting(true);
    sessionCountersRef.current.suggestCalls++;
    const suggestSermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestSuggest({
      text: recent,
      existingItems: feedItems,
      sermonAtMs: suggestSermonAtMs,
      sessionId,
    })
      .then((items) => {
        sessionCountersRef.current.suggestYield += items.length;
        enqueueFeedItems(items);
      })
      .finally(() => setSuggesting(false));
  }, [
    running,
    okChunkCount,
    transcript,
    suggesting,
    finalizing,
    readingMode,
    feedItems,
    enqueueFeedItems,
    sessionId,
  ]);

  useEffect(() => {
    if (!running || finalizing) return;
    if (readingModeRef.current) return;
    const last = feedItems[feedItems.length - 1];
    if (echoingRef.current && last?.kind === "speakerEcho") {
      echoingRef.current = false;
      aiStreakThresholdRef.current = pickEchoThreshold();
    }
    if (echoingRef.current) return;

    let streak = 0;
    for (let i = feedItems.length - 1; i >= 0; i--) {
      if (feedItemOrigin(feedItems[i]) === "ai") streak++;
      else break;
    }
    if (streak < aiStreakThresholdRef.current) return;

    const recent = tailTranscript(transcript, RECENT_TRANSCRIPT_CHARS);
    if (!recent) return;
    const delta = transcript.length - lastEchoTailLenRef.current;
    if (lastEchoTailLenRef.current > 0 && delta < ECHO_MIN_TAIL_DELTA_CHARS) return;

    lastEchoTailLenRef.current = transcript.length;
    echoingRef.current = true;
    const sermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    console.log("[echo] fire", { streak, threshold: aiStreakThresholdRef.current });
    void requestEcho({ text: recent, existingItems: feedItems, sermonAtMs, sessionId })
      .then((items) => {
        if (items.length === 0) {
          echoingRef.current = false;
          return;
        }
        enqueueFeedItems(items);
      })
      .catch(() => {
        echoingRef.current = false;
      });
  }, [feedItems, running, finalizing, transcript, enqueueFeedItems, sessionId]);

  const handleChunk = useCallback(
    async (ev: ChunkEvent) => {
      const startedAtMs = Math.max(0, ev.startedAt - startedAtRef.current);
      const row: ChunkRow = {
        index: ev.index,
        status: "uploading",
        text: "",
        startedAtMs,
      };
      chunksRef.current.set(ev.index, row);
      publish();

      if (await isSilentBlob(ev.blob)) {
        chunksRef.current.set(ev.index, { ...row, status: "silence" });
        publish();
        return;
      }

      const previousText = Array.from(chunksRef.current.values())
        .filter((r) => r.index < ev.index && r.status === "ok")
        .sort((a, b) => a.index - b.index)
        .map((r) => r.text)
        .join(" ");
      const prevHint = tailSentences(previousText, 2);

      const result = await uploadChunkWithRetry(ev, prevHint, sessionId);
      const current = chunksRef.current.get(ev.index);
      if (!current) return;
      if (result.ok) {
        chunksRef.current.set(ev.index, { ...current, status: "ok", text: result.text });
      } else {
        chunksRef.current.set(ev.index, { ...current, status: "error" });
      }
      publish();
    },
    [publish, sessionId]
  );

  const start = useCallback(async () => {
    if (running) return;
    setStartupError("");
    setSaved(false);
    setChunkRows([]);
    setFeedItems([]);
    setThinking("");
    setReadingMode(false);
    setSummary(null);
    setSummaryTitle("");
    titleLockedByUserRef.current = false;
    setRecordingStartedAt(new Date());
    lastExtractChunkRef.current = 0;
    lastSuggestChunkRef.current = 0;
    lastExtractTailLenRef.current = 0;
    lastSuggestTailLenRef.current = 0;
    lastEchoTailLenRef.current = 0;
    echoingRef.current = false;
    aiStreakThresholdRef.current = pickEchoThreshold();
    autoFollowRef.current = true;
    setAutoFollow(true);
    seenItemsLenRef.current = 0;
    setPendingNew(0);
    chunksRef.current = new Map();
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
    dripQueueRef.current = [];
    visibleKeysRef.current = new Set();
    lastAppendedAtRef.current = 0;
    sessionCountersRef.current = {
      extractCalls: 0,
      extractYield: 0,
      suggestCalls: 0,
      suggestYield: 0,
      dedupSuppressed: 0,
      skippedDelta: 0,
    };

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
      startedAtRef.current = performance.now();
      setRunning(true);
      console.log("[session] start", { sessionId, at: new Date().toISOString() });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, running, sessionId]);

  const stop = useCallback(async () => {
    if (!running) return;
    const durationMs = Math.round(performance.now() - startedAtRef.current);
    console.log("[session] stop", {
      sessionId,
      at: new Date().toISOString(),
      durationMs,
      ...sessionCountersRef.current,
    });
    setRunning(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;

    const finalTranscript = Array.from(chunksRef.current.values())
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!finalTranscript) return;

    setFinalizing(true);
    try {
      const result = await requestFinalSummary({
        sessionId,
        text: finalTranscript,
        feedItems,
        durationMs,
        speakerName,
        speakerLocation,
      });
      if (result) {
        setSummary(result.payload);
        if (result.payload.title && !titleLockedByUserRef.current) {
          setSummaryTitle(result.payload.title);
        }
        if (result.saved) {
          setSaved(true);
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
      setFinalizing(false);
    }
  }, [running, feedItems, speakerName, speakerLocation, router, sessionId]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      void recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  // Auto-start once on mount when entering from /spike so the user only has
  // to click "Iniciar" one time. Guarded by autoStartFiredRef so React 18
  // strict-mode double-invoke doesn't fire twice.
  const autoStartFiredRef = useRef(false);
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    void start();
  }, [autoStart, start]);

  useEffect(() => {
    readingModeRef.current = readingMode;
    if (readingMode && dripQueueRef.current.length > 0) {
      const before = dripQueueRef.current.length;
      const hadPendingEcho = dripQueueRef.current.some((e) => e.item.kind === "speakerEcho");
      dripQueueRef.current = dripQueueRef.current.filter((e) => e.item.kind === "citedVerse");
      const dropped = before - dripQueueRef.current.length;
      if (dropped > 0) {
        console.log("[feed] drip-purge", { reason: "readingMode-on", dropped });
      }
      if (hadPendingEcho) echoingRef.current = false;
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

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const elapsedSec = Math.round((performance.now() - startedAtRef.current) / 1000);
      const m = Math.floor(elapsedSec / 60)
        .toString()
        .padStart(2, "0");
      const s = (elapsedSec % 60).toString().padStart(2, "0");
      const c = sessionCountersRef.current;
      console.log("[session] rollup", {
        at: `${m}:${s}`,
        extractCalls: c.extractCalls,
        extractYield: c.extractYield,
        suggestCalls: c.suggestCalls,
        suggestYield: c.suggestYield,
        skippedDelta: c.skippedDelta,
        dedupSuppressed: c.dedupSuppressed,
      });
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
    autoFollowRef.current = true;
    setAutoFollow(true);
    seenItemsLenRef.current = feedItemsRef.current.length;
    setPendingNew(0);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!running) return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      const atTail = distanceFromBottom <= AUTO_FOLLOW_BOTTOM_PX;
      if (atTail !== autoFollowRef.current) {
        autoFollowRef.current = atTail;
        setAutoFollow(atTail);
        if (atTail) {
          seenItemsLenRef.current = feedItemsRef.current.length;
          setPendingNew(0);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [running]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: feedItems.length + thinking are intentional change-triggers, not read inside
  useEffect(() => {
    if (!running) return;
    if (autoFollowRef.current) {
      seenItemsLenRef.current = feedItems.length;
      scrollToBottom();
    } else {
      const unseen = Math.max(0, feedItems.length - seenItemsLenRef.current);
      setPendingNew(unseen);
    }
  }, [running, feedItems.length, thinking, scrollToBottom]);

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
            onTitleChange={setSummaryTitle}
            onTitleLock={() => {
              titleLockedByUserRef.current = true;
            }}
            onSpeakerNameChange={setSpeakerName}
            onSpeakerLocationChange={setSpeakerLocation}
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
                suggesting={suggesting}
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
