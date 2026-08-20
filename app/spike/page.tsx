"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudioPlayer } from "@/features/session/components/AudioPlayer";
import { Feed } from "@/features/session/components/Feed";
import { FinalizingOverlay } from "@/features/session/components/FinalizingOverlay";
import { Greeting } from "@/features/session/components/Greeting";
import { HiddenTabOverlay } from "@/features/session/components/HiddenTabOverlay";
import { RecordButton } from "@/features/session/components/RecordButton";
import { RecordingHeader } from "@/features/session/components/RecordingHeader";
import { SessionMenu } from "@/features/session/components/SessionMenu";
import { StatusPhrases } from "@/features/session/components/StatusPhrases";
import { SummaryView } from "@/features/session/components/SummaryView";
import { TranscriptView } from "@/features/session/components/TranscriptView";
import {
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
  requestExtract,
  requestFinalSummary,
  requestSuggest,
  uploadChunkWithRetry,
} from "@/features/session/lib/api";
import { isSilentBlob } from "@/features/session/lib/audio";
import { tailSentences, tailTranscript } from "@/features/session/lib/text";
import type { ChunkRow, FinalAudio, TranscriptState } from "@/features/session/types";
import { type FeedItem, feedItemDedupKey, referenceStrictlyContains } from "@/lib/domain/feed";
import type { ChunkEvent, Recorder } from "@/lib/domain/recorder";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

export default function SpikePage() {
  return (
    <TranslationProvider>
      <SpikePageInner />
    </TranslationProvider>
  );
}

function SpikePageInner() {
  const recorderRef = useRef<Recorder | null>(null);
  const chunksRef = useRef<Map<number, ChunkRow>>(new Map());
  const startedAtRef = useRef<number>(0);
  const lastExtractChunkRef = useRef(0);
  const lastSuggestChunkRef = useRef(0);
  // Length of the transcript tail last sent to each pipeline. Used to gate the
  // next call: if the tail barely grew, the model already saw ~all of this
  // text on the previous fire — skip and save the tokens.
  const lastExtractTailLenRef = useRef(0);
  const lastSuggestTailLenRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Drip queue: extract/suggest may return 2+ items at once; we release them
  // to the visible feed one at a time with FEED_MIN_GAP_MS spacing so the
  // listener has time to read each card. enqueuedAt lets us log lag from
  // when the item was queued to when it actually appears in the feed.
  const dripQueueRef = useRef<Array<{ item: FeedItem; enqueuedAt: number }>>([]);
  const visibleKeysRef = useRef<Set<string>>(new Set());
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppendedAtRef = useRef(0);

  // Session-level counters for the periodic rollup log.
  const sessionCountersRef = useRef({
    extractCalls: 0,
    extractYield: 0,
    suggestCalls: 0,
    suggestYield: 0,
    dedupSuppressed: 0,
    skippedDelta: 0,
  });

  const titleLockedByUserRef = useRef(false);

  // Kept in sync with the readingMode state so callbacks / recorder-timing
  // effects can read the latest value without adding it to every dep array.
  const readingModeRef = useRef(false);
  // Snapshot of feedItems for range-containment checks in enqueueFeedItems.
  // Synced on every commit so the callback stays free of stale-closure bugs.
  const feedItemsRef = useRef<FeedItem[]>([]);

  const [running, setRunning] = useState(false);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [finalAudio, setFinalAudio] = useState<FinalAudio | null>(null);
  const [startupError, setStartupError] = useState<string>("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [thinking, setThinking] = useState<string>("");
  const [readingMode, setReadingMode] = useState<boolean>(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [speakerName, setSpeakerName] = useState("Autor desconhecido");
  const [speakerLocation, setSpeakerLocation] = useState("Local desconhecido");
  const [recordingStartedAt, setRecordingStartedAt] = useState<Date | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);

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

  /**
   * Release exactly one queued item to the visible feed. Called by
   * enqueueFeedItems and re-scheduled by itself as long as the queue has
   * more. Logs each release so the whole session can be inspected in
   * devtools.
   */
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

  /**
   * Enqueue new items and schedule the drip if it isn't already running.
   * Dedup is checked against both the visible feed and the pending queue so
   * repeat items from overlapping extract/suggest calls don't duplicate.
   *
   * Two range-aware behaviors for `citedVerse`:
   * - SUPERSEDE: an incoming reference that strictly contains an existing
   *   one (e.g., "Tiago 1:1-4" arrives, "Tiago 1:1" is visible) removes the
   *   narrower card so a single card tracks the passage as the pastor reads.
   *   This intentionally departs from the additive-only feed rule; see the
   *   guardrail note in AGENTS.md.
   * - FAST PATH: during readingMode, citedVerse items skip the drip queue
   *   and append immediately — the listener is watching one card grow, not
   *   scanning a stream of new cards, so the 3.5s spacing just adds lag.
   */
  const enqueueFeedItems = useCallback(
    (incoming: FeedItem[]) => {
      if (incoming.length === 0) return;
      let anyDripAdded = false;
      const queuedKeys = new Set(dripQueueRef.current.map((e) => feedItemDedupKey(e.item)));
      const now = Date.now();
      const readingModeNow = readingModeRef.current;
      // Snapshot citedVerses currently in the world (visible + queued) so
      // containment checks see the full picture within this batch.
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

  // Extract pipeline — fires on every completed chunk. Its job is to surface
  // things the speaker actually said (cited verses, verbatim highlights,
  // attributed citations) with as little delay as possible.
  useEffect(() => {
    if (!running || extracting || finalizing) return;
    if (okChunkCount === 0) return;
    const extractN = readingModeRef.current ? EXTRACT_EVERY_N_CHUNKS_READING : EXTRACT_EVERY_N_CHUNKS;
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
    void requestExtract({ text: recent, existingItems: feedItems, sermonAtMs: extractSermonAtMs })
      .then(({ items, thinking: nextThinking, readingMode: nextReadingMode, translationHint }) => {
        sessionCountersRef.current.extractYield += items.length;
        // Warm the verse cache the moment a citedVerse lands, before the drip
        // queue releases it. The /api/verse call runs in parallel with the
        // FEED_MIN_GAP_MS drip so the text is usually cached by the time the
        // card renders — the user sees the verse without a skeleton flash.
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
        // Extract identifies the pastor's translation from verbatim wording.
        // setAuto is a no-op if it matches the current auto value; a manual
        // pick (via TranslationBadge) always wins over this.
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
  ]);

  // Suggest pipeline — slower cadence, needs more accumulated context before
  // deciding whether a related verse / context / quote actually adds value.
  // Paused entirely while readingMode is on: during Bible reading the listener
  // should stay focused on the sacred text without AI enrichment competing
  // for attention.
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
    void requestSuggest({ text: recent, existingItems: feedItems, sermonAtMs: suggestSermonAtMs })
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
  ]);

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

      const result = await uploadChunkWithRetry(ev, prevHint);
      const current = chunksRef.current.get(ev.index);
      if (!current) return;
      if (result.ok) {
        chunksRef.current.set(ev.index, { ...current, status: "ok", text: result.text });
      } else {
        chunksRef.current.set(ev.index, { ...current, status: "error" });
      }
      publish();
    },
    [publish]
  );

  const start = useCallback(async () => {
    if (running) return;
    setStartupError("");
    setFinalAudio(null);
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
    rec.onFinalAudio((ev) => {
      const url = URL.createObjectURL(ev.blob);
      setFinalAudio({ url, extension: ev.extension, sizeBytes: ev.blob.size });
    });

    try {
      await rec.start();
      recorderRef.current = rec;
      // Seed startedAtRef before flipping running=true so useElapsedTimer
      // observes a valid origin on its first render.
      startedAtRef.current = performance.now();
      setRunning(true);
      console.log("[session] start", { at: new Date().toISOString() });
    } catch (err) {
      setStartupError((err as Error).message ?? "failed to start");
    }
  }, [handleChunk, running]);

  const stop = useCallback(async () => {
    if (!running) return;
    const durationMs = Math.round(performance.now() - startedAtRef.current);
    console.log("[session] stop", {
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
      const payload = await requestFinalSummary({
        text: finalTranscript,
        feedItems,
      });
      if (payload) {
        setSummary(payload);
        if (payload.title && !titleLockedByUserRef.current) setSummaryTitle(payload.title);
      }
    } finally {
      setFinalizing(false);
    }
  }, [running, feedItems]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      void recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  // Reading Scripture verbatim → tighter chunks so the extract fires often
  // enough to keep the verse card in sync with the pastor's cadence. Reverts
  // to the default timing the moment the pastor moves back to exposition.
  //
  // Also purges pending non-citedVerse items from the drip queue when
  // readingMode flips true: a suggest call may have been in flight when the
  // pastor started reading; its items would otherwise land mid-passage and
  // push the reading card down the feed. citedVerse items are kept because
  // they're the passage itself.
  useEffect(() => {
    readingModeRef.current = readingMode;
    if (readingMode && dripQueueRef.current.length > 0) {
      const before = dripQueueRef.current.length;
      dripQueueRef.current = dripQueueRef.current.filter((e) => e.item.kind === "citedVerse");
      const dropped = before - dripQueueRef.current.length;
      if (dropped > 0) {
        console.log("[feed] drip-purge", { reason: "readingMode-on", dropped });
      }
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

  // Session rollup: log a one-line summary every 60s while recording so
  // post-session analysis can see yield rates and waste at a glance.
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

  const hasStarted = running || chunkRows.length > 0 || finalAudio !== null;
  const transcriptState: TranscriptState = running
    ? isProcessing
      ? "transcribing"
      : "listening"
    : "idle";

  // Keep the "listening" status line in view whenever a new feed item lands
  // while we're still recording. Scrolls also on thinking updates so the user
  // always sees the latest AI note without hunting.
  // biome-ignore lint/correctness/useExhaustiveDependencies: feedItems.length + thinking are intentional change-triggers, not read inside
  useEffect(() => {
    if (!running) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [running, feedItems.length, thinking]);

  return (
    <main
      className={cn(
        "mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center gap-10 px-6 py-16",
        !hasStarted && "justify-center"
      )}
    >
      {!hasStarted ? <Greeting /> : null}
      {!hasStarted ? (
        <RecordButton running={running} elapsedMs={elapsedMs} onStart={start} onStop={stop} />
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

      {startupError ? (
        <p className="text-sm text-destructive" role="alert">
          {startupError}
        </p>
      ) : null}

      {hasStarted ? (
        <section className="relative flex w-full min-h-[280px] self-stretch flex-col gap-6 p-6">
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
            menu={
              <SessionMenu
                hasTranscript={transcript.length > 0}
                hasAudio={finalAudio !== null}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onOpenAudio={() => setAudioOpen(true)}
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

      <Dialog open={audioOpen} onOpenChange={setAudioOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Áudio completo</DialogTitle>
            <DialogDescription>Reprodução da gravação inteira.</DialogDescription>
          </DialogHeader>
          {finalAudio ? <AudioPlayer audio={finalAudio} /> : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
