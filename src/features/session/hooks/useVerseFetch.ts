"use client";

import { useEffect, useRef, useState } from "react";
import { requestVerse } from "@/features/session/lib/api";
import type { VerseFetchState } from "@/features/session/types";
import type { VersePayload } from "@/lib/domain/verse";

// Module-level cache: verses rarely change between prompts and the API call
// is a fixed cost per (reference, translation). Persists across component
// remounts within the same page load; cleared on navigation, which is fine.
// Keying by translation lets a session switch preference and re-fetch cleanly
// without polluting other cached translations.
const verseCache = new Map<string, VersePayload>();
const verseInFlight = new Map<string, Promise<void>>();

function cacheKey(reference: string, translation?: string | null): string {
  return `${reference}|${translation || "auto"}`;
}

/**
 * Warm the cache for a (reference, translation) ahead of render. Called from
 * the extract pipeline as new verses come into the lookahead window so the
 * text is usually cached by the time the corresponding VerseLine mounts.
 * Safe to call multiple times for the same key — dedupes in-flight promises.
 */
export function prefetchVerse(reference: string, translation?: string | null): void {
  const key = cacheKey(reference, translation);
  if (verseCache.has(key) || verseInFlight.has(key)) return;
  const promise = requestVerse(reference, translation).then((result) => {
    if (result.ok) verseCache.set(key, result.payload);
    verseInFlight.delete(key);
  });
  verseInFlight.set(key, promise);
}

/**
 * Fetch the text for a bible reference in an optional preferred translation,
 * using an in-module cache to keep repeat renders free. Fires whenever
 * `reference` or `translation` change to a non-null reference and cancels
 * the in-flight request when the caller changes.
 *
 * Translation-change UX: when only the translation changes (same reference),
 * the previous text stays on screen until the new one lands — no skeleton
 * flash mid-reading. If the new fetch comes back empty (integrity guard on
 * /api/verse), the previous text is kept rather than blanking the verse.
 */
export function useVerseFetch(
  reference: string | null,
  translation?: string | null
): VerseFetchState {
  const [state, setState] = useState<VerseFetchState>({ status: "idle" });
  // Last successful payload we handed to the UI, tagged by reference so we
  // know it's still relevant when translation changes but ref stays.
  const lastPayloadRef = useRef<VersePayload | null>(null);

  useEffect(() => {
    if (!reference) {
      setState({ status: "idle" });
      return;
    }
    const key = cacheKey(reference, translation);
    const hasStaleTextForRef =
      lastPayloadRef.current !== null && lastPayloadRef.current.reference === reference;

    const cached = verseCache.get(key);
    if (cached) {
      if (cached.text) {
        lastPayloadRef.current = cached;
        setState({ status: "ok", ...cached });
        return;
      }
      // Cached-but-empty: don't blank the display. Keep stale text if we
      // have any for this reference; otherwise fall through and re-fetch
      // (the cache miss branch below handles it).
      if (hasStaleTextForRef) return;
    }

    let cancelled = false;
    // Only transition to loading (skeleton) when there's no relevant text to
    // keep on screen. A translation swap for the same verse skips this so the
    // old text stays visible until the new one is ready.
    if (!hasStaleTextForRef) {
      setState({ status: "loading" });
    }
    void requestVerse(reference, translation).then((result) => {
      if (result.ok && result.payload.text) {
        // Populate cache BEFORE the cancellation check — a superseded fetch
        // that happened to succeed still enriches the cache for future
        // toggles back to that translation.
        verseCache.set(key, result.payload);
      }
      if (cancelled) return;
      if (!result.ok) {
        if (!hasStaleTextForRef) setState({ status: "error", message: result.message });
        return;
      }
      if (result.payload.text) {
        lastPayloadRef.current = result.payload;
        setState({ status: "ok", ...result.payload });
      } else if (!hasStaleTextForRef) {
        // No stale text and the fetch came back empty — surface the empty
        // ok state so the caller knows the fetch is done (progressive-reveal
        // in PassageVerses needs this signal to stop waiting on this verse).
        setState({ status: "ok", ...result.payload });
      }
      // else: keep the previous text visible, don't blank on empty refetch.
    });
    return () => {
      cancelled = true;
    };
  }, [reference, translation]);

  return state;
}
