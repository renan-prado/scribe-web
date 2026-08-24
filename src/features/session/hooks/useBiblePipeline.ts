"use client";

import { type RefObject, useEffect, useMemo } from "react";
import {
  BIBLE_GUARD_COOLDOWN_MS,
  BIBLE_GUARD_CURRENT_READING_TTL_MS,
  BIBLE_GUARD_THRESHOLD,
  BIBLE_GUARD_VERB_WINDOW_WORDS,
  BIBLE_MIN_TAIL_DELTA_CHARS,
  BIBLE_TRANSCRIPT_CHARS,
} from "@/features/session/config";
import { requestBible } from "@/features/session/lib/api";
import { tailTranscript } from "@/features/session/lib/text";
import { hasBibleMention } from "@/lib/bible/detect";
import { canonicalBookStem, scoreBibleGuard } from "@/lib/bible/guard";
import { parseVerseReference } from "@/lib/domain/feed";
import { devLog } from "@/lib/log";
import { useSessionStore } from "@/lib/stores/session";

/**
 * BIBLE pipeline. Gate em duas camadas:
 *   1. `hasBibleMention` — regex barato: sem menção, sai.
 *   2. `scoreBibleGuard` — soma sinais ponderados (livro+número, verbo de
 *      leitura, anáfora demonstrativa, cooldown, etc.). Só chama a rota se
 *      passar do threshold.
 *
 * Após um retorno com `citedVerse`, atualiza `currentReading` (habilita
 * continuationHit/verseProgression) e `lastBibleEmit` (arma o cooldown).
 */
export function useBiblePipeline({
  sessionId,
  prefetchVerse,
  scheduleDrainIfIdle,
  startedAtRef,
}: {
  sessionId: string;
  prefetchVerse: (reference: string) => void;
  scheduleDrainIfIdle: () => void;
  startedAtRef: RefObject<number>;
}): void {
  const running = useSessionStore((s) => s.running);
  const finalizing = useSessionStore((s) => s.finalizing);
  const bibleInFlight = useSessionStore((s) => s.bibleInFlight);
  const feedItems = useSessionStore((s) => s.feedItems);
  const chunks = useSessionStore((s) => s.chunks);

  const { transcript, okChunkCount } = useMemo(() => {
    const ok = Object.values(chunks)
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.index - b.index);
    const text = ok
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { transcript: text, okChunkCount: ok.length };
  }, [chunks]);

  useEffect(() => {
    if (!running || bibleInFlight || finalizing) return;
    if (okChunkCount === 0) return;
    const recent = tailTranscript(transcript, BIBLE_TRANSCRIPT_CHARS);
    if (!recent) return;
    const store = useSessionStore.getState();
    if (!hasBibleMention(recent)) {
      store.bumpCounter("bibleGateSkipped");
      return;
    }
    const guard = scoreBibleGuard(
      recent,
      {
        currentReading: store.currentReading,
        lastEmit: store.lastBibleEmit,
        nowMs: Date.now(),
        currentReadingTtlMs: BIBLE_GUARD_CURRENT_READING_TTL_MS,
        cooldownMs: BIBLE_GUARD_COOLDOWN_MS,
        verbWindowWords: BIBLE_GUARD_VERB_WINDOW_WORDS,
      },
      BIBLE_GUARD_THRESHOLD
    );
    if (guard.decision === "skip") {
      store.bumpCounter("bibleGuardSkipped");
      devLog("[bible-guard] skip", { score: guard.score, signals: guard.signals });
      return;
    }
    // Delta pós-guard: se o LLM anterior respondeu 0 items, `lastBibleEmit`
    // não atualizou e o guard vai re-aprovar o mesmo tail em loop. O delta
    // exige que a transcrição tenha crescido desde o último fire.
    const delta = transcript.length - store.lastBibleFiredTailLen;
    if (store.lastBibleFiredTailLen > 0 && delta < BIBLE_MIN_TAIL_DELTA_CHARS) {
      return;
    }
    devLog("[bible-guard] fire", { score: guard.score, signals: guard.signals });
    store.setLastBibleFiredTailLen(transcript.length);
    store.setBibleInFlight(true);
    store.bumpCounter("bibleCalls");
    const bibleSermonAtMs = Math.max(0, performance.now() - startedAtRef.current);
    void requestBible({
      text: recent,
      existingItems: feedItems,
      sermonAtMs: bibleSermonAtMs,
      sessionId,
    })
      .then((items) => {
        const s = useSessionStore.getState();
        s.bumpCounter("bibleYield", items.length);
        const nowMs = Date.now();
        let latestRef: ReturnType<typeof parseVerseReference> | null = null;
        let latestRefStr = "";
        for (const item of items) {
          if (item.kind !== "citedVerse") continue;
          if (item.text === "" && item.reference.includes(":")) {
            prefetchVerse(item.reference);
          }
          const parsed = parseVerseReference(item.reference);
          if (parsed) {
            latestRef = parsed;
            latestRefStr = item.reference;
          }
        }
        if (latestRef) {
          s.setCurrentReading({
            book: canonicalBookStem(latestRef.bookDisplay),
            bookDisplay: latestRef.bookDisplay,
            chapter: latestRef.chapter,
            verse: latestRef.startVerse ?? latestRef.endVerse,
            updatedAtMs: nowMs,
          });
          s.setLastBibleEmit({ reference: latestRefStr, atMs: nowMs });
        }
        const { hasDripAdd } = s.enqueueFeedItems(items);
        if (hasDripAdd) scheduleDrainIfIdle();
      })
      .finally(() => useSessionStore.getState().setBibleInFlight(false));
  }, [
    running,
    okChunkCount,
    transcript,
    bibleInFlight,
    finalizing,
    feedItems,
    sessionId,
    prefetchVerse,
    scheduleDrainIfIdle,
    startedAtRef,
  ]);
}
