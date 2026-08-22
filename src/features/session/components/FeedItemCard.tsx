"use client";

import { BookOpen, ChevronDown, Quote } from "lucide-react";
import { type ElementType, useCallback, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiIcon } from "@/features/session/components/AiIcon";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import {
  LIVE_READING_ACTIVE_GRACE_MS,
  LIVE_READING_LOOKAHEAD_PREFETCH,
} from "@/features/session/config";
import { KNOWN_TRANSLATIONS, useTranslation } from "@/features/session/hooks/useTranslation";
import { useVerseFetch, useVersePrefetcher } from "@/features/session/hooks/useVerseFetch";
import { chapterVerseCount } from "@/lib/bibles/books";
import type { FeedItem } from "@/lib/domain/feed";
import { feedItemOrigin, parseVerseReference } from "@/lib/domain/feed";
import { cn } from "@/lib/utils";

/**
 * Avatar for AI-authored feed messages. Placeholder icon for now — swap for a
 * real logo when the brand is settled. Sized to sit flush against the top-left
 * of the card bubble.
 */
function AiAvatar() {
  return (
    <div
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
    >
      <AiIcon className="size-4" />
    </div>
  );
}

type ChipMeta = { icon: ElementType<{ className?: string }> | null; label: string };

function chipFor(item: FeedItem): ChipMeta {
  switch (item.kind) {
    case "citedVerse":
      return { icon: BookOpen, label: "Leitura Bíblica" };
    case "speakerHighlight":
      return { icon: Quote, label: "Destaque" };
    case "speakerEcho":
      return { icon: null, label: "Frase para relembrar" };
    case "speakerCitation":
      return { icon: Quote, label: "Citação" };
    case "relatedVerse":
      return { icon: BookOpen, label: "Leia também" };
    case "context":
      return { icon: null, label: item.label || "Contexto" };
    case "suggestedQuote":
      return { icon: Quote, label: "Citação sugerida" };
  }
}

const GENERIC_SOURCES = new Set([
  "tradição judaica",
  "comentário bíblico",
  "comentário",
  "estudo bíblico",
  "tradição cristã",
  "tradição",
  "teologia",
  "hermenêutica",
  "exegese",
  "dicionário bíblico",
]);

function isConcreteSource(source: string): boolean {
  return !GENERIC_SOURCES.has(source.trim().toLowerCase());
}

/**
 * Single feed card. Card treatment carries the ORIGIN (recording → quote
 * gradient like bibleQuote; ai → outlined muted). Chip on top carries the
 * TYPE. Verse-bearing kinds are clickable and delegate to the parent's
 * onOpenVerse handler, which drives the shared bible-verse dialog.
 *
 * speakerHighlight is the one exception — it renders as a standalone
 * centered blockquote (no card frame) to match the original "highlight"
 * treatment in BlockRenderer.
 */
export function FeedItemCard({
  item,
  onOpenVerse,
  isActiveReading = false,
}: {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
  /** True only for the most recent citedVerse WHILE readingMode is on. Drives
   * the sliding-window lookahead in ReadingPassage; when false, the passage
   * renders exactly the extracted range with no speculative verses. */
  isActiveReading?: boolean;
}) {
  // Tracks the translation of the text actually on screen (from the first
  // verse's resolved payload). May differ from effective when the model
  // falls back to a known translation (e.g. asked for NVT, returned ARC).
  const [resolvedTranslation, setResolvedTranslation] = useState<string | null>(null);
  const handleTranslationResolved = useCallback((t: string) => {
    setResolvedTranslation(t);
  }, []);

  if (item.kind === "speakerHighlight") {
    return <HighlightBlock text={item.text} />;
  }

  if (item.kind === "speakerEcho") {
    return <EchoBlock text={item.text} />;
  }

  // Prompt-authored placeholder — the model was told "if the pastor only
  // mentioned a reference without quoting, emit speakerCitation with text
  // 'referência mencionada em passagem: X'". That text is meaningless in the
  // UI. Suppress the card entirely; the extract pipeline should be emitting
  // citedVerse for these passing mentions now.
  if (item.kind === "speakerCitation" && /^referência mencionada/i.test(item.text.trim())) {
    return null;
  }

  const origin = feedItemOrigin(item);
  const chip = chipFor(item);
  const ChipIcon = chip.icon;

  // AI-authored cards render as chat messages from the AI: avatar on the left,
  // bubble with rounded-tl-none flush against it. Recording-sourced cards
  // stand alone (they represent the SPEAKER's material, not an AI message).
  const isAi = origin === "ai";
  const surfaceClass = cn(
    "relative flex flex-1 flex-col gap-4 p-6",
    isAi
      ? "rounded-3xl rounded-tl-none border-2 border-dashed border-border/80 bg-muted/30"
      : "rounded-3xl border border-border animate-insight-gradient"
  );
  const surfaceStyle = isAi
    ? undefined
    : {
        backgroundImage: "var(--session-surface-quote)",
        backgroundSize: "200% 200%",
      };

  // The translation badge sits on the top-right of citedVerse cards with a
  // parseable range — it's the only kind where a translation choice is
  // meaningful (chapter-only refs and non-verse items don't render text).
  const showTranslationBadge =
    item.kind === "citedVerse" &&
    (() => {
      const p = parseVerseReference(item.reference);
      return p !== null && p.startVerse != null && p.endVerse != null;
    })();

  const card = (
    <article className={surfaceClass} style={surfaceStyle}>
      <div className="flex items-center justify-between gap-3 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
        <div className="flex items-center gap-1.5">
          {ChipIcon ? <ChipIcon className="size-3" /> : null}
          <span>{chip.label}</span>
        </div>
        {showTranslationBadge ? (
          <TranslationBadge resolvedTranslation={resolvedTranslation} />
        ) : null}
      </div>
      <FeedItemBody
        item={item}
        onOpenVerse={onOpenVerse}
        isActiveReading={isActiveReading}
        onTranslationResolved={handleTranslationResolved}
      />
    </article>
  );

  if (isAi) {
    return (
      <div className="animate-content-fade flex items-start gap-3">
        <AiAvatar />
        {card}
      </div>
    );
  }

  return <div className="animate-content-fade">{card}</div>;
}

/**
 * Rendered when a sermon-echo lands: a literal phrase the speaker just said,
 * shown as a raw pull-quote with no card frame — the "reality check" between
 * runs of AI cards. Deliberately different treatment from HighlightBlock
 * (yellow highlight, curated) and from speakerCitation (attributed): this is
 * the pastor's own voice, mid-flow, unadorned.
 */
function EchoBlock({ text }: { text: string }) {
  return (
    <figure className="animate-content-fade my-4 border-l-2 border-border pl-5">
      <figcaption className="mb-2 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
        Frase para relembrar
      </figcaption>
      <blockquote className="text-pretty font-heading text-xl italic leading-relaxed text-foreground/85">
        {text}
      </blockquote>
    </figure>
  );
}

function HighlightBlock({ text }: { text: string }) {
  return (
    <figure className="animate-content-fade my-4 px-4 text-center sm:px-8">
      <blockquote className="text-pretty text-lg font-semibold leading-loose tracking-tight text-foreground sm:text-xl">
        <span
          aria-hidden
          className="mr-3 select-none align-[-0.25em] font-heading text-4xl leading-none text-muted-foreground/30"
        >
          ❝
        </span>
        <span className="bg-[var(--session-highlight-yellow)] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
          {text}
        </span>
        <span
          aria-hidden
          className="ml-3 select-none align-[-0.25em] font-heading text-4xl leading-none text-muted-foreground/30"
        >
          ❞
        </span>
      </blockquote>
    </figure>
  );
}

/**
 * When the extract call returns a relatedVerse (or another non-passage ref
 * without inline text), fetch it lazily via /api/verse. Uses the shared
 * verseCache so repeat renders are free. Passing null skips the fetch.
 */
function VerseText({ reference, initialText }: { reference: string; initialText: string }) {
  const state = useVerseFetch(initialText ? null : reference);
  const text = initialText || (state.status === "ok" ? state.text : "");
  if (text) {
    return (
      <blockquote className="pl-3 text-sm leading-relaxed text-foreground/90">{text}</blockquote>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-2 pl-3">
        <div className="h-3 w-11/12 animate-skeleton-shimmer rounded-md bg-muted" />
        <div className="h-3 w-3/5 animate-skeleton-shimmer rounded-md bg-muted [animation-delay:120ms]" />
      </div>
    );
  }
  return null;
}

/**
 * Wraps PassageVerses for LIVE reading. The visible range mirrors the extract
 * output exactly (badge and text stay in sync), and a silent prefetch warms
 * the cache for verses just beyond the confirmed end — so when extract grows
 * the range the next expansion renders instantly from cache.
 *
 * The parent Feed keys citedVerse cards by book+chapter (feedItemStableKey),
 * so this component stays mounted across range grows — only the individual
 * verse lines mount/unmount as the passage extends.
 */
function ReadingPassage({
  bookDisplay,
  chapter,
  startVerse,
  extractedEndVerse,
  isActive,
  onTranslationResolved,
}: {
  bookDisplay: string;
  chapter: number;
  startVerse: number;
  extractedEndVerse: number;
  /** Gates the silent prefetch: while true we warm the cache for verses
   * beyond the current end; once inactive (with a grace period) we stop
   * prefetching to avoid wasted /api/verse calls for a passage that ended. */
  isActive: boolean;
  onTranslationResolved?: (translation: string) => void;
}) {
  const { effective: translation } = useTranslation();
  const prefetchVerse = useVersePrefetcher();
  // Debounce isActive=false: readingMode from extract flips briefly when the
  // model treats a pause or short interjection as commentary. Only after
  // GRACE_MS of continuous inactivity do we stop prefetching.
  const [effectiveActive, setEffectiveActive] = useState(isActive);
  useEffect(() => {
    if (isActive) {
      setEffectiveActive(true);
      return;
    }
    const timer = setTimeout(() => setEffectiveActive(false), LIVE_READING_ACTIVE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    if (!effectiveActive) return;
    // Cap lookahead at chapter end. Matthew 3 has 17 verses — prefetching v18-v23
    // burns 6 useless /api/verse round-trips per session (and pollutes the React
    // Query cache with empty results). Falls back to LOOKAHEAD when the chapter
    // isn't in metadata (unknown book) — safer to over-prefetch than to fail-open.
    const chapterEnd = chapterVerseCount(bookDisplay, chapter);
    const lookaheadEnd = chapterEnd
      ? Math.min(chapterEnd, extractedEndVerse + LIVE_READING_LOOKAHEAD_PREFETCH)
      : extractedEndVerse + LIVE_READING_LOOKAHEAD_PREFETCH;
    for (let v = extractedEndVerse + 1; v <= lookaheadEnd; v++) {
      prefetchVerse(`${bookDisplay} ${chapter}:${v}`, translation);
    }
  }, [bookDisplay, chapter, extractedEndVerse, effectiveActive, translation, prefetchVerse]);

  return (
    <PassageVerses
      bookDisplay={bookDisplay}
      chapter={chapter}
      startVerse={startVerse}
      endVerse={extractedEndVerse}
      onTranslationResolved={onTranslationResolved}
    />
  );
}

/**
 * Small badge on the top-right of a reading card. Shows the translation of
 * the text actually on screen (resolvedTranslation from the first verse's
 * payload), falling back to the requested effective translation while loading.
 * Clicking opens a dropdown to override the session-wide preference.
 */
function TranslationBadge({ resolvedTranslation }: { resolvedTranslation: string | null }) {
  const { effective, manual, auto, setManual } = useTranslation();
  const label = resolvedTranslation ?? effective ?? "auto";
  const source = manual ? "manual" : auto ? "auto" : "padrão";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5",
          "text-[0.6rem] font-semibold tracking-wider text-foreground/70 uppercase",
          "transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        title={`Tradução (${source}) — clique para trocar`}
      >
        <span>{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem onClick={() => setManual(null)}>
          Auto {!manual && auto ? `(${auto})` : ""}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {KNOWN_TRANSLATIONS.map((t) => (
          <DropdownMenuItem key={t} onClick={() => setManual(t)}>
            {t}
            {effective === t ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FeedItemBody({
  item,
  onOpenVerse,
  isActiveReading,
  onTranslationResolved,
}: {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
  isActiveReading: boolean;
  onTranslationResolved?: (translation: string) => void;
}) {
  switch (item.kind) {
    case "citedVerse": {
      // Chapter-only refs ("Salmo 119") show up during the announcement phase,
      // before the pastor starts reading specific verses. Render as a plain
      // label — no fetch (would return the entire chapter), no click (dialog
      // has nothing meaningful to show). dedupeConsecutiveChapters will remove
      // this once a verse-numbered ref for the same chapter arrives.
      const parsed = parseVerseReference(item.reference);
      if (!parsed || parsed.startVerse == null || parsed.endVerse == null) {
        return (
          <span className="self-start inline-flex items-center rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-semibold text-background">
            {item.reference}
          </span>
        );
      }
      return (
        <>
          <button
            type="button"
            onClick={() => onOpenVerse(item.reference)}
            className={cn(
              "self-start inline-flex items-center rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-semibold text-background transition-opacity outline-none",
              "hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            {item.reference}
          </button>
          <ReadingPassage
            bookDisplay={parsed.bookDisplay}
            chapter={parsed.chapter}
            startVerse={parsed.startVerse}
            extractedEndVerse={parsed.endVerse}
            isActive={isActiveReading}
            onTranslationResolved={onTranslationResolved}
          />
        </>
      );
    }
    case "speakerHighlight":
      // Handled above at top-level to skip the card frame.
      return null;
    case "speakerCitation":
      return (
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="text-base italic leading-relaxed text-foreground/85">
            {item.text}
          </blockquote>
          <figcaption className="mt-1.5 text-xs text-muted-foreground">— {item.author}</figcaption>
        </figure>
      );
    case "relatedVerse":
      return (
        <>
          <button
            type="button"
            onClick={() => onOpenVerse(item.reference)}
            className={cn(
              "self-start inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[0.7rem] font-semibold text-foreground/85 transition-colors outline-none",
              "hover:border-foreground/60 hover:bg-muted hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            {item.reference}
          </button>
          <VerseText reference={item.reference} initialText="" />
          {item.reason ? (
            <p className="text-xs leading-relaxed text-foreground/75">{item.reason}</p>
          ) : null}
        </>
      );
    case "context":
      return (
        <>
          <p className="text-pretty text-sm leading-relaxed text-foreground/85">{item.text}</p>
          {item.source && isConcreteSource(item.source) ? (
            <p className="text-[0.7rem] italic text-muted-foreground">— {item.source}</p>
          ) : null}
        </>
      );
    case "suggestedQuote":
      return (
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="text-sm italic leading-relaxed text-foreground/85">
            {item.text}
          </blockquote>
          <figcaption className="mt-1.5 text-xs text-muted-foreground">— {item.author}</figcaption>
          {item.reason ? (
            <p className="mt-2 text-[0.7rem] leading-relaxed text-foreground/65">{item.reason}</p>
          ) : null}
        </figure>
      );
  }
}
