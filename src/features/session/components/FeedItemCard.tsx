"use client";

import { BookGlyph } from "@/components/icons/BookGlyph";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import type { FeedItem } from "@/lib/domain/feed";
import { feedItemOrigin, parseVerseReference } from "@/lib/domain/feed";
import { cn } from "@/lib/utils";

function AiAvatar() {
  return (
    <div
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--scriba-avatar-gradient)]"
    >
      <svg
        aria-hidden="true"
        width={16}
        height={16}
        viewBox="0 0 155 155"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
      </svg>
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
      ? "rounded-3xl rounded-tl-none bg-scriba-bubble px-5 py-4 text-scriba-bubble-ink"
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
