"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Portuguese Bible translations recognized across the app. Keep in sync with
 * lib/prompts/verse.ts and lib/prompts/extract.ts — the LLM is instructed to
 * only pick from this set. Adding one here without updating the prompts will
 * result in the auto-detect never suggesting it.
 */
export const KNOWN_TRANSLATIONS = [
  "ACF",
  "ARA",
  "ARC",
  "KJA",
  "KJF",
  "NAA",
  "NBV",
  "NTLH",
  "NVI",
  "NVT",
  "OL",
] as const;
export type Translation = (typeof KNOWN_TRANSLATIONS)[number];

/**
 * Session-wide default before extract has a chance to auto-detect. NVI is
 * one of the most widely-published Portuguese translations, so the model
 * tends to reproduce it with high integrity — a safe fallback that keeps
 * verses non-blank on first render.
 */
export const DEFAULT_TRANSLATION: Translation = "NVI";

type PreferencesState = {
  /** User-selected translation. Wins over auto-detect. Persisted. */
  translationManual: string | null;
  /** Auto-detected translation from extract's translationHint. In-memory only. */
  translationAuto: string | null;
  setTranslationManual: (next: string | null) => void;
  setTranslationAuto: (next: string) => void;
  /** Called at session start to clear the previous session's auto-detect. */
  resetTranslationAuto: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      translationManual: null,
      translationAuto: DEFAULT_TRANSLATION,
      setTranslationManual: (next) => set({ translationManual: next }),
      setTranslationAuto: (next) => {
        const clean = next.trim().toUpperCase();
        if (!clean) return;
        set((prev) => (prev.translationAuto === clean ? prev : { translationAuto: clean }));
      },
      resetTranslationAuto: () => set({ translationAuto: DEFAULT_TRANSLATION }),
    }),
    {
      name: "scribe:preferences",
      storage: createJSONStorage(() => localStorage),
      // Only manual selection persists — auto-detect is per-session and should
      // never carry over from a prior recording.
      partialize: (state) => ({ translationManual: state.translationManual }),
      version: 1,
    }
  )
);

/** Effective translation to use for /api/verse calls. null = LLM picks freely. */
export const selectEffectiveTranslation = (state: PreferencesState): string | null =>
  state.translationManual ?? state.translationAuto ?? null;
