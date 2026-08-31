"use client";

import { useCallback, useEffect, useRef } from "react";
import { uploadChunk } from "@/features/session/lib/api";
import {
  deleteChunk,
  deleteExpiredChunks,
  listChunksForSession,
  putChunk,
  type StoredChunk,
} from "@/lib/chunk-store";
import { devLog } from "@/lib/log";

/**
 * Chunks older than this are dropped instead of retried on mount. Keeps the
 * store from ballooning when a user abandons a session for days. Value chosen
 * to comfortably survive an overnight interruption + morning finish.
 */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * Retry backoff between upload attempts. The last value is repeated forever
 * (until success or the tab dies). We don't give up on our own — the user
 * can always stop the recording, which triggers a drain with a soft timeout.
 */
const RETRY_BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 60_000];

export type EnqueueInput = {
  index: number;
  blob: Blob;
  mimeType: string;
  extension: string;
  startedAt: number;
  durationMs: number;
  prevText: string;
};

type QueueEntry = {
  chunk: StoredChunk;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
};

type Args = {
  sessionId: string;
  /**
   * Called once per recovered orphan on mount, BEFORE its upload attempt is
   * scheduled. Use it to seed the transcript row as "uploading" so the UI
   * reflects that recovered audio is being processed.
   */
  onOrphanRecovered?: (chunk: StoredChunk) => void;
  onSuccess: (index: number, text: string, suspect: boolean) => void;
};

export type TranscribeQueue = {
  enqueue: (input: EnqueueInput) => Promise<void>;
  /**
   * Wait until the queue is empty. Resolves with `drained: true` on success
   * or `drained: false` if the timeout hits first (caller decides whether to
   * proceed with an incomplete transcript). Default timeout: 60s.
   */
  drain: (timeoutMs?: number) => Promise<{ drained: boolean; pending: number }>;
  pendingCount: () => number;
};

export function useTranscribeQueue({
  sessionId,
  onOrphanRecovered,
  onSuccess,
}: Args): TranscribeQueue {
  const pendingRef = useRef<Map<number, QueueEntry>>(new Map());
  const drainResolversRef = useRef<Array<() => void>>([]);
  const onSuccessRef = useRef(onSuccess);
  const onOrphanRef = useRef(onOrphanRecovered);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  useEffect(() => {
    onOrphanRef.current = onOrphanRecovered;
  }, [onOrphanRecovered]);

  const notifyDrained = useCallback(() => {
    if (pendingRef.current.size !== 0) return;
    const resolvers = drainResolversRef.current;
    drainResolversRef.current = [];
    for (const r of resolvers) r();
  }, []);

  const attempt = useCallback(
    async (index: number) => {
      const entry = pendingRef.current.get(index);
      if (!entry || entry.inFlight) return;
      entry.inFlight = true;
      entry.chunk.attempts += 1;

      const { chunk } = entry;
      const result = await uploadChunk({
        blob: chunk.blob,
        index: chunk.index,
        extension: chunk.extension,
        durationMs: chunk.durationMs,
        prevText: chunk.prevText,
        sessionId: chunk.sessionId,
      });

      // Recheck: caller might have cleared the queue while we were awaiting.
      const stillPending = pendingRef.current.get(index);
      if (!stillPending) return;
      stillPending.inFlight = false;

      if (result.ok) {
        pendingRef.current.delete(index);
        void deleteChunk(chunk.sessionId, index);
        devLog("[queue] chunk uploaded", {
          index,
          attempts: chunk.attempts,
          durationMs: chunk.durationMs,
        });
        onSuccessRef.current(index, result.text, result.suspect);
        notifyDrained();
        return;
      }

      // Persist the bumped attempt count so a reload sees an accurate history.
      void putChunk(chunk);
      const backoffIdx = Math.min(chunk.attempts - 1, RETRY_BACKOFF_MS.length - 1);
      const delay = RETRY_BACKOFF_MS[Math.max(0, backoffIdx)];
      devLog("[queue] chunk retry", {
        index,
        attempts: chunk.attempts,
        delay,
        error: result.message,
      });
      if (stillPending.timer) clearTimeout(stillPending.timer);
      stillPending.timer = setTimeout(() => {
        stillPending.timer = null;
        void attempt(index);
      }, delay);
    },
    [notifyDrained]
  );

  const flushAll = useCallback(() => {
    for (const [index, entry] of pendingRef.current) {
      if (entry.inFlight) continue;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      void attempt(index);
    }
  }, [attempt]);

  const enqueue = useCallback(
    async (input: EnqueueInput) => {
      const chunk: StoredChunk = {
        sessionId,
        index: input.index,
        blob: input.blob,
        mimeType: input.mimeType,
        extension: input.extension,
        startedAt: input.startedAt,
        durationMs: input.durationMs,
        prevText: input.prevText,
        createdAt: Date.now(),
        attempts: 0,
      };
      // Persist first so a tab-death between here and the upload response
      // still leaves the chunk recoverable on next mount.
      await putChunk(chunk);
      pendingRef.current.set(input.index, { chunk, timer: null, inFlight: false });
      void attempt(input.index);
    },
    [sessionId, attempt]
  );

  const drain = useCallback(
    (timeoutMs = 60_000): Promise<{ drained: boolean; pending: number }> => {
      if (pendingRef.current.size === 0) {
        return Promise.resolve({ drained: true, pending: 0 });
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (drained: boolean) => {
          if (settled) return;
          settled = true;
          resolve({ drained, pending: pendingRef.current.size });
        };
        drainResolversRef.current.push(() => finish(true));
        setTimeout(() => finish(false), timeoutMs);
      });
    },
    []
  );

  const pendingCount = useCallback(() => pendingRef.current.size, []);

  // Orphan recovery + retry triggers.
  useEffect(() => {
    let cancelled = false;

    const recover = async () => {
      // Global prune of anything older than the TTL, regardless of session.
      const removed = await deleteExpiredChunks(ORPHAN_TTL_MS);
      if (removed > 0) devLog("[queue] pruned expired chunks", { removed });

      const rows = await listChunksForSession(sessionId);
      if (cancelled) return;
      const cutoff = Date.now() - ORPHAN_TTL_MS;
      for (const row of rows) {
        if (row.createdAt < cutoff) {
          void deleteChunk(row.sessionId, row.index);
          continue;
        }
        // Skip if we somehow re-enqueued this index already.
        if (pendingRef.current.has(row.index)) continue;
        pendingRef.current.set(row.index, { chunk: row, timer: null, inFlight: false });
        onOrphanRef.current?.(row);
        void attempt(row.index);
      }
      if (rows.length > 0) {
        devLog("[queue] orphan recovery", {
          sessionId,
          candidates: rows.length,
          enqueued: pendingRef.current.size,
        });
      }
    };
    void recover();

    const onOnline = () => flushAll();
    const onVis = () => {
      if (document.visibilityState === "visible") flushAll();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      // Cancel pending retry timers on unmount so we don't touch React state
      // after the hook is gone. In-flight fetches will resolve into no-ops
      // because their pendingRef lookup will still be present but the caller
      // is unmounted — worst case a duplicate upload if the tab is remounted
      // for the same sessionId, which the queue on the new mount will
      // reconcile via the IDB list.
      for (const entry of pendingRef.current.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
      }
    };
  }, [sessionId, attempt, flushAll]);

  return { enqueue, drain, pendingCount };
}
