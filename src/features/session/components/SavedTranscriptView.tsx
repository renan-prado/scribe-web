"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * YouTube-style timestamp: drops the leading zero on minutes ("1:09" not
 * "01:09"), keeping the seconds zero-padded. Falls back to "h:mm:ss" past
 * one hour.
 */
function formatTranscriptTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * YouTube-style saved transcript panel.
 *
 * Saved sessions only persist the raw transcript string (no per-chunk
 * timings), so we synthesize timestamps by splitting the transcript into
 * paragraphs and distributing durationMs proportionally by cumulative
 * character count. The result is an approximate but monotonic timeline the
 * reader can scan, mirroring YouTube's mobile transcript UI:
 *
 *   [mm:ss]  line of text
 *   [mm:ss]  line of text
 *
 * A search box filters and highlights matching rows in-place.
 */

type Line = { timestampMs: number; text: string };

/**
 * Split into paragraphs (double newline). Falls back to sentence-ish chunks
 * so a single-blob transcript still renders as multiple rows.
 */
function splitTranscript(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed
    .split(/\n{2,}/g)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  // Single-blob fallback: split by sentence terminators, then re-group so no
  // row is uselessly tiny (< ~200 chars).
  const sentences = trimmed
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÜÇ])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [trimmed.replace(/\s+/g, " ")];
  const groups: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length + 1 < 260) {
      current = current ? `${current} ${s}` : s;
    } else {
      if (current) groups.push(current);
      current = s;
    }
  }
  if (current) groups.push(current);
  return groups;
}

function distributeTimestamps(paragraphs: string[], durationMs: number | null): Line[] {
  if (paragraphs.length === 0) return [];
  const total = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const dur = durationMs && durationMs > 0 ? durationMs : 0;
  const lines: Line[] = [];
  let cumulative = 0;
  for (const text of paragraphs) {
    const timestampMs = dur > 0 && total > 0 ? Math.floor((cumulative / total) * dur) : 0;
    lines.push({ timestampMs, text });
    cumulative += text.length;
  }
  return lines;
}

/**
 * Case- and diacritic-insensitive contains check + segmented highlight.
 * Returns null when the query is empty (caller renders raw text).
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const needle = stripDiacritics(query.toLowerCase());
  const haystack = stripDiacritics(text.toLowerCase());
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={`${idx}-${cursor}`}
        className="rounded-[3px] bg-scriba-yellow-light px-0.5 text-scriba-ink-strong"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    cursor = idx + needle.length;
  }
  return parts;
}

export function SavedTranscriptView({
  transcript,
  durationMs,
}: {
  transcript: string;
  durationMs: number | null;
}) {
  const [query, setQuery] = useState("");

  const lines = useMemo(
    () => distributeTimestamps(splitTranscript(transcript), durationMs),
    [transcript, durationMs]
  );

  const normalizedQuery = query.trim();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return lines;
    const needle = stripDiacritics(normalizedQuery.toLowerCase());
    return lines.filter((l) => stripDiacritics(l.text.toLowerCase()).includes(needle));
  }, [lines, normalizedQuery]);

  if (lines.length === 0) {
    return <p className="text-sm font-light text-scriba-ink-mute">Sem transcrição.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-scriba-ink-mute"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar na transcrição"
          className={cn(
            "w-full rounded-full border border-scriba-hairline bg-scriba-paper py-2 pl-9 pr-9 text-sm font-light text-scriba-ink outline-none transition-colors",
            "placeholder:text-scriba-ink-mute",
            "hover:border-scriba-ink-mute/40",
            "focus:border-scriba-ink-mute/60"
          )}
          aria-label="Pesquisar na transcrição"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:bg-scriba-hairline hover:text-scriba-ink"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="pt-4 text-center text-sm font-light text-scriba-ink-mute">
          Nenhum resultado para "{normalizedQuery}".
        </p>
      ) : (
        <ol className="flex flex-col gap-4 pt-1">
          {filtered.map((line, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraph order is stable inside a saved session
              key={i}
              className="flex gap-4"
            >
              <span className="mt-0.5 inline-flex h-5 shrink-0 items-center justify-center rounded-md bg-scriba-hairline-soft px-1.5 font-mono text-[10px] font-medium tabular-nums text-scriba-ink-mute">
                {formatTranscriptTimestamp(line.timestampMs)}
              </span>
              <p className="min-w-0 flex-1 text-pretty text-[15px] font-light leading-relaxed text-scriba-ink">
                {highlight(line.text, normalizedQuery)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
