"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ECHO_STREAK_MAX, ECHO_STREAK_MIN } from "@/features/session/config";
import type { ChunkRow } from "@/features/session/types";
import { type FeedItem, feedItemDedupKey, referenceStrictlyContains } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { devLog } from "@/lib/log";

export type SessionCounters = {
  bibleCalls: number;
  bibleYield: number;
  bibleGateSkipped: number;
  insightsCalls: number;
  insightsYield: number;
  dedupSuppressed: number;
  skippedDelta: number;
  skippedBackpressure: number;
};

const INITIAL_COUNTERS: SessionCounters = {
  bibleCalls: 0,
  bibleYield: 0,
  bibleGateSkipped: 0,
  insightsCalls: 0,
  insightsYield: 0,
  dedupSuppressed: 0,
  skippedDelta: 0,
  skippedBackpressure: 0,
};

type DripEntry = { item: FeedItem; enqueuedAt: number };

export type EnqueueResult = {
  /** True if any item was pushed onto the drip queue — the caller needs to
   * schedule the drain timer if it isn't already running. */
  hasDripAdd: boolean;
};

/**
 * Sample a fresh echo threshold in [ECHO_STREAK_MIN, ECHO_STREAK_MAX]. Re-sampled
 * every time an echo actually reveals so the cadence between echoes doesn't feel
 * metronomic to the listener.
 */
function pickEchoThreshold(): number {
  const span = ECHO_STREAK_MAX - ECHO_STREAK_MIN + 1;
  return ECHO_STREAK_MIN + Math.floor(Math.random() * span);
}

export type ResetArgs = {
  speakerName: string;
  speakerLocation: string;
};

export type SessionStoreState = {
  // ---- lifecycle ----
  running: boolean;
  finalizing: boolean;
  saved: boolean;
  startupError: string;
  recordingStartedAt: Date | null;

  // ---- transcription data ----
  /** Sparse map keyed by chunk index. Kept as an object (immutable-friendly)
   * instead of a Map because Zustand selectors compare with Object.is. */
  chunks: Record<number, ChunkRow>;

  // ---- feed data ----
  feedItems: FeedItem[];

  // ---- final output ----
  summary: SummaryPayload | null;
  summaryTitle: string;
  titleLockedByUser: boolean;
  speakerName: string;
  speakerLocation: string;

  // ---- pipeline flight flags ----
  bibleInFlight: boolean;
  insightsInFlight: boolean;

  // ---- feed drip / dedup internals ----
  dripQueue: DripEntry[];
  visibleKeys: Set<string>;
  lastAppendedAt: number;

  // ---- pipeline gates (delta tracking) ----
  lastBibleTailLen: number;
  lastInsightsTailLen: number;
  lastEchoTailLen: number;

  // ---- echo state machine ----
  aiStreakThreshold: number;
  echoing: boolean;

  // ---- ui (auto-follow scroll) ----
  autoFollow: boolean;
  pendingNew: number;
  seenItemsLen: number;

  // ---- telemetry ----
  counters: SessionCounters;

  // ============ actions ============

  /** Full reset for a new session start. Preserves nothing except any
   * component-level refs (recorder, DOM refs, mount guards). */
  reset: (args: ResetArgs) => void;

  // primitive setters
  setRunning: (v: boolean) => void;
  setFinalizing: (v: boolean) => void;
  setSaved: (v: boolean) => void;
  setStartupError: (v: string) => void;
  setRecordingStartedAt: (v: Date | null) => void;
  setSummary: (v: SummaryPayload | null) => void;
  setSummaryTitle: (v: string) => void;
  lockTitle: () => void;
  setSpeakerName: (v: string) => void;
  setSpeakerLocation: (v: string) => void;
  setBibleInFlight: (v: boolean) => void;
  setInsightsInFlight: (v: boolean) => void;
  setAutoFollow: (v: boolean) => void;
  setPendingNew: (v: number) => void;
  setSeenItemsLen: (v: number) => void;

  setLastBibleTailLen: (v: number) => void;
  setLastInsightsTailLen: (v: number) => void;
  setLastEchoTailLen: (v: number) => void;
  setEchoing: (v: boolean) => void;
  rerollEchoThreshold: () => void;

  bumpCounter: (key: keyof SessionCounters, by?: number) => void;

  /** Upsert a chunk row atomically. Silence and error transitions replace the
   * previous entry; ok transitions overwrite text. */
  upsertChunk: (row: ChunkRow) => void;

  /**
   * Enqueue LLM-produced feed items with dedup/supersede logic.
   * Returns whether the drain timer needs scheduling.
   */
  enqueueFeedItems: (incoming: FeedItem[]) => EnqueueResult;

  /**
   * Attempt to drain the head of the drip queue. Callers own the setTimeout —
   * this action performs at most one drip on this call.
   *
   * Returns:
   *  - drained: true if an item moved from queue to feedItems on this call.
   *  - hasMore: true if the queue is non-empty AFTER this call (schedule another timer).
   */
  drainOne: () => { drained: boolean; hasMore: boolean };
};

/**
 * Snapshot getter for use inside callbacks/effects that must read the *current*
 * state atomically without subscribing (which would invalidate memoized deps).
 * See `getSessionState()` for the plain function form.
 */
export const useSessionStore = create<SessionStoreState>()(
  subscribeWithSelector((set, get) => ({
    // ---- initial state ----
    running: false,
    finalizing: false,
    saved: false,
    startupError: "",
    recordingStartedAt: null,

    chunks: {},

    feedItems: [],

    summary: null,
    summaryTitle: "",
    titleLockedByUser: false,
    speakerName: "",
    speakerLocation: "",

    bibleInFlight: false,
    insightsInFlight: false,

    dripQueue: [],
    visibleKeys: new Set<string>(),
    lastAppendedAt: 0,

    lastBibleTailLen: 0,
    lastInsightsTailLen: 0,
    lastEchoTailLen: 0,

    aiStreakThreshold: pickEchoThreshold(),
    echoing: false,

    autoFollow: true,
    pendingNew: 0,
    seenItemsLen: 0,

    counters: { ...INITIAL_COUNTERS },

    // ---- actions ----

    reset: ({ speakerName, speakerLocation }) =>
      set({
        running: false,
        finalizing: false,
        saved: false,
        startupError: "",
        recordingStartedAt: null,
        chunks: {},
        feedItems: [],
        summary: null,
        summaryTitle: "",
        titleLockedByUser: false,
        speakerName,
        speakerLocation,
        bibleInFlight: false,
        insightsInFlight: false,
        dripQueue: [],
        visibleKeys: new Set<string>(),
        lastAppendedAt: 0,
        lastBibleTailLen: 0,
        lastInsightsTailLen: 0,
        lastEchoTailLen: 0,
        aiStreakThreshold: pickEchoThreshold(),
        echoing: false,
        autoFollow: true,
        pendingNew: 0,
        seenItemsLen: 0,
        counters: { ...INITIAL_COUNTERS },
      }),

    setRunning: (v) => set({ running: v }),
    setFinalizing: (v) => set({ finalizing: v }),
    setSaved: (v) => set({ saved: v }),
    setStartupError: (v) => set({ startupError: v }),
    setRecordingStartedAt: (v) => set({ recordingStartedAt: v }),
    setSummary: (v) => set({ summary: v }),
    setSummaryTitle: (v) => set({ summaryTitle: v }),
    lockTitle: () => set({ titleLockedByUser: true }),
    setSpeakerName: (v) => set({ speakerName: v }),
    setSpeakerLocation: (v) => set({ speakerLocation: v }),
    setBibleInFlight: (v) => set({ bibleInFlight: v }),
    setInsightsInFlight: (v) => set({ insightsInFlight: v }),
    setAutoFollow: (v) => set({ autoFollow: v }),
    setPendingNew: (v) => set({ pendingNew: v }),
    setSeenItemsLen: (v) => set({ seenItemsLen: v }),

    setLastBibleTailLen: (v) => set({ lastBibleTailLen: v }),
    setLastInsightsTailLen: (v) => set({ lastInsightsTailLen: v }),
    setLastEchoTailLen: (v) => set({ lastEchoTailLen: v }),
    setEchoing: (v) => set({ echoing: v }),
    rerollEchoThreshold: () => set({ aiStreakThreshold: pickEchoThreshold() }),

    bumpCounter: (key, by = 1) =>
      set((s) => ({ counters: { ...s.counters, [key]: s.counters[key] + by } })),

    upsertChunk: (row) => set((s) => ({ chunks: { ...s.chunks, [row.index]: row } })),

    enqueueFeedItems: (incoming) => {
      if (incoming.length === 0) return { hasDripAdd: false };

      const s = get();

      // Work-in-progress copies. We commit them all in a single set() at the end.
      const visibleKeys = new Set(s.visibleKeys);
      let dripQueue = s.dripQueue.slice();
      let feedItems = s.feedItems;
      let dedupSuppressedInc = 0;
      let hasDripAdd = false;

      // Snapshot the currently-known citedVerse references (visible + queued) so
      // supersede computes against a single ordered view. Order matters: newer
      // items processed in this call may supersede items enqueued earlier in the
      // same call.
      let currentCitedVerses: Array<Extract<FeedItem, { kind: "citedVerse" }>> = [
        ...feedItems,
        ...dripQueue.map((e) => e.item),
      ].filter((i): i is Extract<FeedItem, { kind: "citedVerse" }> => i.kind === "citedVerse");

      const queuedKeys = new Set(dripQueue.map((e) => feedItemDedupKey(e.item)));

      for (const item of incoming) {
        const key = feedItemDedupKey(item);
        if (visibleKeys.has(key)) {
          dedupSuppressedInc++;
          devLog("[feed] dedup-suppressed", {
            kind: item.kind,
            key,
            reason: "already-visible",
          });
          continue;
        }
        if (queuedKeys.has(key)) {
          dedupSuppressedInc++;
          devLog("[feed] dedup-suppressed", {
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
            dedupSuppressedInc++;
            devLog("[feed] dedup-suppressed", {
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
              visibleKeys.delete(k);
              queuedKeys.delete(k);
            }
            dripQueue = dripQueue.filter((e) => !supersededKeys.has(feedItemDedupKey(e.item)));
            feedItems = feedItems.filter((i) => !supersededKeys.has(feedItemDedupKey(i)));
            currentCitedVerses = currentCitedVerses.filter(
              (i) => !supersededKeys.has(feedItemDedupKey(i))
            );
            devLog("[feed] supersede", {
              newer: item.reference,
              removed: [...supersededKeys],
            });
          }
        }

        queuedKeys.add(key);
        dripQueue = [...dripQueue, { item, enqueuedAt: Date.now() }];
        if (item.kind === "citedVerse") currentCitedVerses.push(item);
        hasDripAdd = true;
      }

      set((prev) => ({
        visibleKeys,
        dripQueue,
        feedItems,
        counters:
          dedupSuppressedInc > 0
            ? {
                ...prev.counters,
                dedupSuppressed: prev.counters.dedupSuppressed + dedupSuppressedInc,
              }
            : prev.counters,
      }));

      return { hasDripAdd };
    },

    drainOne: () => {
      const s = get();
      const entry = s.dripQueue[0];
      if (!entry) return { drained: false, hasMore: false };

      const { item, enqueuedAt } = entry;
      const key = feedItemDedupKey(item);
      const visibleKeys = new Set(s.visibleKeys);
      visibleKeys.add(key);
      const lagMs = Date.now() - enqueuedAt;
      devLog("[feed] +item", {
        kind: item.kind,
        key,
        lagMs,
        at: new Date().toISOString(),
        item,
      });

      set({
        dripQueue: s.dripQueue.slice(1),
        visibleKeys,
        feedItems: [...s.feedItems, item],
        lastAppendedAt: Date.now(),
      });

      return { drained: true, hasMore: get().dripQueue.length > 0 };
    },
  }))
);

/** Non-hook access to the current state — for use inside callbacks/effects that
 * must read the latest value without adding a store subscription. */
export const getSessionState = () => useSessionStore.getState();
