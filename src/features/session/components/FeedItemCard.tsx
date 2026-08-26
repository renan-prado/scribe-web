"use client";

import { BookGlyph } from "@/components/icons/BookGlyph";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import type { FeedItem } from "@/lib/domain/feed";
import { feedItemOrigin, parseVerseReference } from "@/lib/domain/feed";
import { cn } from "@/lib/utils";

/**
 * Avatar for AI-authored feed messages: a diamond mark on a soft-blue circle.
 * Sits flush against the top-left of the card bubble.
 */
function AiAvatar() {
  return (
    <div
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft"
    >
      <span className="block size-2.5 rotate-45 rounded-[3px] bg-scriba-blue" />
    </div>
  );
}

type ChipMeta = { icon: "book" | null; label: string };

function chipFor(item: FeedItem): ChipMeta {
  switch (item.kind) {
    case "citedVerse":
      return { icon: "book", label: "Leitura bíblica" };
    case "speakerHighlight":
      return { icon: null, label: "Destaque" };
    case "speakerEcho":
      return { icon: null, label: "Frase para relembrar" };
    case "speakerCitation":
      return { icon: null, label: "Citação na fala" };
    case "relatedVerse":
      return { icon: "book", label: "Leia também" };
    case "context":
      return { icon: null, label: item.label || "Contexto" };
    case "suggestedQuote":
      return { icon: null, label: "Citação sugerida" };
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
 * Single feed card. Speaker-sourced items sit on a light-blue animated gradient
 * (matches BlockRenderer's bibleQuote/conclusion). AI-authored items render as
 * a chat bubble from a diamond avatar with a dashed outline.
 *
 * speakerHighlight and speakerEcho break out of the card frame entirely — see
 * HighlightBlock / EchoBlock.
 */
type FeedItemCardProps = {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
};

export function FeedItemCard({ item, onOpenVerse }: FeedItemCardProps) {
  if (item.kind === "speakerHighlight") {
    return <HighlightBlock text={item.text} />;
  }

  if (item.kind === "speakerEcho") {
    return <EchoBlock text={item.text} />;
  }

  if (item.kind === "speakerCitation" && /^referência mencionada/i.test(item.text.trim())) {
    return null;
  }

  if (item.kind === "citedVerse") {
    const parsed = parseVerseReference(item.reference);
    if (!parsed || parsed.startVerse == null) return null;
  }

  const origin = feedItemOrigin(item);
  const chip = chipFor(item);
  const isAi = origin === "ai";

  const surfaceClass = cn(
    "relative flex flex-1 flex-col gap-3",
    isAi
      ? "rounded-3xl rounded-tl-md border border-dashed border-scriba-blue-soft bg-scriba-blue-soft/40 px-5 py-4"
      : "rounded-[22px] p-5 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]"
  );

  const chipColor = isAi ? "text-scriba-ink-mute" : "text-session-chip-ai";

  const card = (
    <article className={surfaceClass}>
      <div className={cn("flex items-center gap-1.5", chipColor)}>
        {chip.icon === "book" ? <BookGlyph className="size-3" /> : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{chip.label}</span>
      </div>
      <FeedItemBody item={item} onOpenVerse={onOpenVerse} isAi={isAi} />
    </article>
  );

  if (isAi) {
    return (
      <div className="animate-content-fade flex items-start gap-2.5">
        <AiAvatar />
        {card}
      </div>
    );
  }

  return <div className="animate-content-fade">{card}</div>;
}

function EchoBlock({ text }: { text: string }) {
  return (
    <figure className="animate-content-fade my-2 flex flex-col gap-2 border-l-2 border-scriba-hairline py-1 pl-4">
      <figcaption className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
        Frase para relembrar
      </figcaption>
      <blockquote className="text-pretty text-base italic leading-relaxed text-scriba-ink/90 sm:text-lg">
        {text}
      </blockquote>
    </figure>
  );
}

function HighlightBlock({ text }: { text: string }) {
  return (
    <figure className="animate-content-fade my-2 flex flex-col items-center gap-1.5 px-4 text-center sm:px-8">
      <span
        aria-hidden
        className="select-none text-4xl font-semibold leading-none text-scriba-hairline-soft"
      >
        "
      </span>
      <blockquote className="text-pretty text-lg font-medium leading-relaxed text-scriba-ink-strong sm:text-xl">
        <span className="bg-[linear-gradient(transparent_58%,var(--session-highlight-yellow)_58%)] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
          {text}
        </span>
      </blockquote>
    </figure>
  );
}

type VerseTextProps = {
  reference: string;
  initialText: string;
};

function VerseText({ reference, initialText }: VerseTextProps) {
  const state = useVerseFetch(initialText ? null : reference);
  const text = initialText || (state.status === "ok" ? state.text : "");
  if (text) {
    return (
      <blockquote className="border-l-[3px] border-session-verse-border pl-3.5 text-[15px] font-light italic leading-relaxed text-session-verse-text">
        {text}
      </blockquote>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-2 pl-3.5">
        <div className="h-3 w-11/12 animate-skeleton-shimmer rounded-md bg-white/60" />
        <div className="h-3 w-3/5 animate-skeleton-shimmer rounded-md bg-white/60 [animation-delay:120ms]" />
      </div>
    );
  }
  return null;
}

type FeedItemBodyProps = {
  item: FeedItem;
  onOpenVerse: (reference: string) => void;
  isAi: boolean;
};

function FeedItemBody({ item, onOpenVerse, isAi }: FeedItemBodyProps) {
  switch (item.kind) {
    case "citedVerse": {
      const parsed = parseVerseReference(item.reference);
      if (!parsed || parsed.startVerse == null || parsed.endVerse == null) return null;
      return (
        <>
          <button
            type="button"
            onClick={() => onOpenVerse(item.reference)}
            className={cn(
              "self-start inline-flex items-center rounded-full bg-scriba-ink-strong px-4 py-1.5 text-xs font-semibold text-white transition-opacity outline-none",
              "hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            {item.reference}
          </button>
          <div className="text-[15px] font-light leading-relaxed text-session-verse-text">
            <PassageVerses
              bookDisplay={parsed.bookDisplay}
              chapter={parsed.chapter}
              startVerse={parsed.startVerse}
              endVerse={parsed.endVerse}
            />
          </div>
        </>
      );
    }
    case "speakerHighlight":
      return null;
    case "speakerCitation":
      return (
        <>
          <blockquote className="border-l-[3px] border-session-verse-border pl-3.5 text-[15px] font-light italic leading-relaxed text-session-verse-text">
            {item.text}
          </blockquote>
          <p className="text-xs font-medium text-scriba-ink-soft">— {item.author}</p>
        </>
      );
    case "relatedVerse":
      return (
        <>
          <button
            type="button"
            onClick={() => onOpenVerse(item.reference)}
            className={cn(
              "self-start inline-flex items-center rounded-full border border-[#B9CEDF] bg-white/60 px-3.5 py-1.5 text-xs font-semibold text-[#5B7183] transition-colors outline-none",
              "hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            {item.reference}
          </button>
          <VerseText reference={item.reference} initialText="" />
          {item.reason ? (
            <p
              className={cn(
                "text-xs font-light leading-relaxed",
                isAi ? "text-scriba-ink-mute" : "text-session-verse-text/75"
              )}
            >
              {item.reason}
            </p>
          ) : null}
        </>
      );
    case "context":
      return (
        <>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            {item.text}
          </p>
          {item.source && isConcreteSource(item.source) ? (
            <p className="text-[11px] italic font-light text-scriba-ink-mute">— {item.source}</p>
          ) : null}
        </>
      );
    case "suggestedQuote":
      return (
        <>
          <blockquote className="text-sm font-light italic leading-relaxed text-scriba-ink">
            {item.text}
          </blockquote>
          <p className="text-xs font-medium text-scriba-ink-soft">— {item.author}</p>
          {item.reason ? (
            <p className="text-[11px] font-light leading-relaxed text-scriba-ink-mute">
              {item.reason}
            </p>
          ) : null}
        </>
      );
  }
}
