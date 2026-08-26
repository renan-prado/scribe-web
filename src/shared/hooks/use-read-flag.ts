"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "scriba:read:";

function storageKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(key)) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(key), "1");
  } catch {
    // storage unavailable (private mode, quota) — silently drop
  }
}

/**
 * Persistent boolean "seen/read" flag keyed by a stable string.
 *
 * Returns `[read, markRead]`. `read` is:
 * - `undefined` before hydration (server render + first client render, before
 *   the localStorage effect fires) — lets callers avoid a flash of the
 *   "unread" indicator for values that will resolve to `true`;
 * - `true` if the key was previously marked read;
 * - `false` otherwise.
 *
 * `markRead` is idempotent and safe to call even before hydration.
 */
export function useReadFlag(key: string): [boolean | undefined, () => void] {
  const [read, setRead] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setRead(readFlag(key));
  }, [key]);

  const markRead = useCallback(() => {
    setRead((prev) => {
      if (prev === true) return prev;
      writeFlag(key);
      return true;
    });
  }, [key]);

  return [read, markRead];
}
