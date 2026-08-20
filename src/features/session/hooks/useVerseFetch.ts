"use client";

import { useEffect, useState } from "react";
import { requestVerse } from "@/features/session/lib/api";
import type { VerseFetchState } from "@/features/session/types";
import type { VersePayload } from "@/lib/domain/verse";

// Module-level cache: verses rarely change between prompts and the API call
// is a fixed cost per reference. Persists across component remounts within
// the same page load; cleared on navigation, which is fine.
const verseCache = new Map<string, VersePayload>();
const verseInFlight = new Map<string, Promise<void>>();

/**
 * Warm the cache for a reference ahead of render. Called from the extract
 * pipeline the moment a citedVerse lands, so by the time the card is
 * released from the drip queue useVerseFetch resolves instantly instead of
 * hitting the API. Safe to call multiple times for the same ref — dedupes
 * in-flight promises.
 */
export function prefetchVerse(reference: string): void {
  if (verseCache.has(reference) || verseInFlight.has(reference)) return;
  const promise = requestVerse(reference).then((result) => {
    if (result.ok) verseCache.set(reference, result.payload);
    verseInFlight.delete(reference);
  });
  verseInFlight.set(reference, promise);
}

/**
 * Fetch the text for a bible reference, using an in-module cache to keep
 * repeat clicks free. Fires whenever `reference` changes to a non-null value
 * and cancels the in-flight request when the caller changes references.
 */
export function useVerseFetch(reference: string | null): VerseFetchState {
  const [state, setState] = useState<VerseFetchState>({ status: "idle" });

  useEffect(() => {
    if (!reference) {
      setState({ status: "idle" });
      return;
    }
    const cached = verseCache.get(reference);
    if (cached) {
      setState({ status: "ok", ...cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void requestVerse(reference).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", message: result.message });
        return;
      }
      verseCache.set(reference, result.payload);
      setState({ status: "ok", ...result.payload });
    });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  return state;
}
