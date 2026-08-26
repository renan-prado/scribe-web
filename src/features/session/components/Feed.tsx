"use client";

import { Activity, useState } from "react";
import { FeedItemCard } from "@/features/session/components/FeedItemCard";
import { VerseDialog } from "@/features/session/components/VerseDialog";
import type { FeedItem } from "@/lib/domain/feed";
import { feedItemStableKey } from "@/lib/domain/feed";

/**
 * Live feed of extracted + suggested items. Purely additive during a
 * recording: new items append at the bottom, nothing is rewritten or
 * reordered. Clicking a verse-bearing card opens the shared verse dialog.
 *
 * `suggesting` renders a WhatsApp-style typing indicator at the end of the
 * feed while the AI-authored pipeline is in flight — makes the wait feel
 * conversational rather than dead.
 */
type FeedProps = {
  items: FeedItem[];
  running: boolean;
  hasTranscript: boolean;
  suggesting: boolean;
};

export function Feed({ items, running, hasTranscript, suggesting }: FeedProps) {
  const [openRef, setOpenRef] = useState<string | null>(null);

  if (items.length === 0 && !suggesting) {
    if (running || hasTranscript) {
      return <FeedEmptyState />;
    }
    return <p className="text-sm text-muted-foreground">O feed aparecerá aqui.</p>;
  }

  const displayItems = dedupeGrowingHighlights(dedupeConsecutiveChapters(items));

  return (
    <>
      <div className="flex flex-col gap-4">
        {displayItems.map((item) => {
          const key = feedItemStableKey(item);
          return <FeedItemCard key={key} item={item} onOpenVerse={setOpenRef} />;
        })}
        <Activity mode={suggesting ? "visible" : "hidden"}>
          <SuggestingIndicator />
        </Activity>
      </div>
      <VerseDialog reference={openRef} onOpenChange={(open) => !open && setOpenRef(null)} />
    </>
  );
}

/**
 * WhatsApp-style typing indicator: same avatar + dashed bubble the AI cards
 * use, but content is three pulsing dots instead of a real message. Only
 * appears while /api/insights is in flight.
 */
function SuggestingIndicator() {
  return (
    <div
      className="animate-content-fade flex items-start gap-2.5"
      role="status"
      aria-label="A IA está preparando uma sugestão"
    >
      <div
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft"
      >
        <span className="block size-2.5 rotate-45 rounded-[3px] bg-scriba-blue" />
      </div>
      <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md border border-dashed border-scriba-blue-soft bg-scriba-blue-soft/40 px-5 py-4">
        <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC]" />
        <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC] [animation-delay:200ms]" />
        <span className="size-1.5 animate-listening-dot rounded-full bg-[#9BB6CC] [animation-delay:400ms]" />
      </div>
    </div>
  );
}

function FeedEmptyState() {
  return (
    <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink-mute">
      Versículos citados, destaques da fala e referências correlatas vão aparecer aqui conforme a
      gravação avança.
    </p>
  );
}

function chapterOf(reference: string): string {
  return reference.split(":")[0].trim().toLowerCase();
}

/**
 * When consecutive citedVerse items reference the same chapter (e.g. "Salmo
 * 119:1" followed by "Salmo 119:1-3"), only keep the later one — it supersedes
 * the earlier narrower reference.
 */
function dedupeConsecutiveChapters(items: FeedItem[]): FeedItem[] {
  const verseIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "citedVerse") verseIndices.push(i);
  }

  const suppressed = new Set<number>();
  for (let i = 0; i < verseIndices.length - 1; i++) {
    const curr = items[verseIndices[i]] as Extract<FeedItem, { kind: "citedVerse" }>;
    const next = items[verseIndices[i + 1]] as Extract<FeedItem, { kind: "citedVerse" }>;
    if (chapterOf(curr.reference) === chapterOf(next.reference)) {
      suppressed.add(verseIndices[i]);
    }
  }

  return suppressed.size === 0 ? items : items.filter((_, i) => !suppressed.has(i));
}

function normalizeHighlight(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;]+$/, "");
}

/**
 * When a speaker highlight grows across consecutive extractions (e.g. "X é Y"
 * later refined to "O X é Y ou Z, ambos válidos"), suppress the shorter
 * version. Uses substring containment (not prefix), so a shorter earlier
 * highlight can be superseded even when the later version added a leading
 * clause ("Minha pergunta é: X?" contains "X?"). Guarded by a min-length
 * threshold so short common phrases don't collapse two distinct highlights.
 */
function dedupeGrowingHighlights(items: FeedItem[]): FeedItem[] {
  const highlightIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "speakerHighlight") highlightIndices.push(i);
  }

  const suppressed = new Set<number>();
  for (let i = 0; i < highlightIndices.length - 1; i++) {
    const curr = items[highlightIndices[i]] as Extract<FeedItem, { kind: "speakerHighlight" }>;
    const next = items[highlightIndices[i + 1]] as Extract<FeedItem, { kind: "speakerHighlight" }>;
    const currNorm = normalizeHighlight(curr.text);
    const nextNorm = normalizeHighlight(next.text);
    if (currNorm.length >= 20 && nextNorm.includes(currNorm)) {
      suppressed.add(highlightIndices[i]);
    }
  }

  return suppressed.size === 0 ? items : items.filter((_, i) => !suppressed.has(i));
}
