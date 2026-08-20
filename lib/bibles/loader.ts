import { promises as fs } from "node:fs";
import path from "node:path";

export type BibleBook = { abbrev: string; chapters: string[][] };
export type Bible = BibleBook[];

const BIBLES_DIR = path.join(process.cwd(), "lib", "bibles");
const cache = new Map<string, Bible>();
const loading = new Map<string, Promise<Bible | null>>();

export const AVAILABLE_TRANSLATIONS = [
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

export type AvailableTranslation = (typeof AVAILABLE_TRANSLATIONS)[number];

/** Load a translation JSON from disk, cached in memory after first read. */
export async function loadBible(translation: string): Promise<Bible | null> {
  const key = translation.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const inFlight = loading.get(key);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<Bible | null> => {
    try {
      const raw = await fs.readFile(path.join(BIBLES_DIR, `${key}.json`), "utf-8");
      const data = JSON.parse(raw) as Bible;
      cache.set(key, data);
      return data;
    } catch {
      return null;
    } finally {
      loading.delete(key);
    }
  })();

  loading.set(key, promise);
  return promise;
}

export function isAvailableTranslation(t: string): boolean {
  return (AVAILABLE_TRANSLATIONS as readonly string[]).includes(t.toUpperCase());
}
