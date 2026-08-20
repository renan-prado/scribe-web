"use client";

import { BookOpen, Quote } from "lucide-react";
import type { ElementType } from "react";
import { AiIcon } from "@/features/session/components/AiIcon";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import type { FeedItem } from "@/lib/domain/feed";
import { feedItemOrigin } from "@/lib/domain/feed";
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
}: {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
}) {
  if (item.kind === "speakerHighlight") {
    return <HighlightBlock text={item.text} />;
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

  const card = (
    <article className={surfaceClass} style={surfaceStyle}>
      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
        {ChipIcon ? <ChipIcon className="size-3" /> : null}
        <span>{chip.label}</span>
      </div>
      <FeedItemBody item={item} onOpenVerse={onOpenVerse} />
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
 * When the extract call couldn't return the verse text (either unknown to the
 * model or over a long range), fetch it lazily via /api/verse. Uses the shared
 * verseCache so repeat renders are free. Passing null skips the fetch entirely.
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

function FeedItemBody({
  item,
  onOpenVerse,
}: {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
}) {
  switch (item.kind) {
    case "citedVerse": {
      // Chapter-only refs ("Salmo 119") show up during the announcement phase,
      // before the pastor starts reading specific verses. Render as a plain
      // label — no fetch (would return the entire chapter), no click (dialog
      // has nothing meaningful to show). dedupeConsecutiveChapters will remove
      // this once a verse-numbered ref for the same chapter arrives.
      const hasVerseNumber = item.reference.includes(":");
      if (!hasVerseNumber) {
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
          <VerseText reference={item.reference} initialText={item.text} />
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
