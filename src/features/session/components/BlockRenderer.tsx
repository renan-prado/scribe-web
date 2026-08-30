import { BookGlyph } from "@/components/icons/BookGlyph";
import { PenaGlyph } from "@/components/icons/PenaGlyph";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { PenaAvatar } from "@/features/session/components/PenaAvatar";
import { parseVerseReference } from "@/lib/domain/feed";
import type { SummaryBlock } from "@/lib/domain/summary";

export function blockKey(block: SummaryBlock): string {
  if (block.type === "bibleQuote") return `${block.reference}-${block.text.slice(0, 24)}`;
  if (block.type === "quote") return `${block.text.slice(0, 24)}-${block.author ?? ""}`;
  if (block.type === "contextCard") return `${block.label}-${block.text.slice(0, 24)}`;
  if (block.type === "relatedVerse") return `${block.reference}-${block.reason.slice(0, 24)}`;
  return block.text.slice(0, 32);
}

export function BlockRenderer({ block }: { block: SummaryBlock }) {
  switch (block.type) {
    case "h1":
      return (
        <h2 className="mt-4 font-heading text-[22px] font-bold leading-tight tracking-tight text-scriba-ink-strong sm:text-2xl">
          {block.text}
        </h2>
      );
    case "h2":
      return (
        <h3 className="mt-4 font-heading text-lg font-semibold leading-snug tracking-tight text-session-verse-text">
          {block.text}
        </h3>
      );
    case "paragraph":
      return (
        <p className="text-pretty text-[15px] font-light leading-[1.72] text-scriba-ink">
          {block.text}
        </p>
      );
    case "example":
      return (
        <aside className="relative rounded-2xl border-l-4 border-[var(--session-example-border)] bg-[var(--session-example-bg)] px-5 py-4">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            Exemplo do pregador
          </span>
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            {block.text}
          </p>
        </aside>
      );
    case "bibleQuote": {
      const parsed = parseVerseReference(block.reference);
      const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;
      return (
        <figure className="relative flex flex-col gap-3.5 rounded-[26px] p-6 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]">
          <figcaption>
            <span className="inline-flex items-center gap-2 rounded-full bg-scriba-ink-strong px-4 py-1.5 text-xs font-semibold text-white">
              <BookGlyph className="size-3 border-white" />
              {block.reference}
            </span>
          </figcaption>
          {hasRange ? (
            <div className="text-[15px] font-light leading-relaxed text-session-verse-text">
              <PassageVerses
                bookDisplay={parsed.bookDisplay}
                chapter={parsed.chapter}
                startVerse={parsed.startVerse as number}
                endVerse={parsed.endVerse as number}
              />
            </div>
          ) : block.text ? (
            <blockquote className="text-[15px] font-light leading-relaxed text-session-verse-text">
              {block.text}
            </blockquote>
          ) : null}
        </figure>
      );
    }
    case "highlight":
      return (
        <figure className="mt-2 mb-6 flex flex-col items-center gap-1.5 px-4 text-center sm:mb-8 sm:px-8">
          <span
            aria-hidden
            className="select-none text-4xl font-semibold leading-none text-scriba-hairline-soft"
          >
            "
          </span>
          <blockquote className="text-pretty text-lg font-semibold leading-relaxed text-scriba-ink-strong sm:text-xl">
            <span className="bg-[linear-gradient(transparent_58%,var(--session-highlight-yellow)_58%)] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {block.text}
            </span>
          </blockquote>
          <span
            aria-hidden
            className="select-none text-4xl font-semibold leading-none text-scriba-hairline-soft"
          >
            "
          </span>
        </figure>
      );
    case "conclusion":
      return (
        <section className="relative mt-2 flex flex-col gap-3 rounded-[26px] p-6 animate-insight-gradient bg-[image:var(--session-surface-quote)] bg-[size:200%_100%]">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
            <PenaGlyph className="size-3" />
            Conclusão
          </span>
          <p className="text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text">
            {block.text}
          </p>
        </section>
      );
    case "quote":
      return (
        <figure className="flex flex-col gap-1.5 border-l-2 border-scriba-hairline pl-4">
          <blockquote className="text-[15px] font-light italic leading-relaxed text-scriba-ink-soft">
            {block.text}
          </blockquote>
          {block.author ? (
            <figcaption className="text-xs font-normal text-scriba-ink-mute">
              — {block.author}
            </figcaption>
          ) : null}
        </figure>
      );
    case "contextCard":
      return (
        <details open className="group animate-content-fade">
          <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
            <PenaAvatar />
            <span className="mt-0.5 text-xs font-semibold text-scriba-ink-soft">Scriba</span>
            <span
              aria-hidden
              className="mt-0.5 text-[10px] text-scriba-ink-mute transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="-mt-2 ml-[42px] flex flex-col gap-3.5 rounded-3xl rounded-tl-none bg-scriba-bubble px-5 py-4 text-scriba-bubble-ink">
            <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
              {block.text}
            </p>
            {block.source ? (
              <p className="text-[11px] font-light italic text-scriba-ink-soft">— {block.source}</p>
            ) : null}
          </div>
        </details>
      );
    case "relatedVerse": {
      const parsed = parseVerseReference(block.reference);
      const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;
      return (
        <details open className="group animate-content-fade">
          <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
            <PenaAvatar />
            <span className="mt-0.5 text-xs font-semibold text-scriba-ink-soft">Scriba</span>
            <span
              aria-hidden
              className="mt-0.5 text-[10px] text-scriba-ink-mute transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="-mt-2 ml-[42px] flex flex-col gap-3.5 rounded-3xl rounded-tl-none bg-scriba-bubble px-5 py-4 text-scriba-bubble-ink">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-soft">
              Leia também · {block.reference}
            </span>
            {hasRange ? (
              <div className="text-[15px] font-light leading-relaxed text-session-verse-text">
                <PassageVerses
                  bookDisplay={parsed.bookDisplay}
                  chapter={parsed.chapter}
                  startVerse={parsed.startVerse as number}
                  endVerse={parsed.endVerse as number}
                />
              </div>
            ) : block.text ? (
              <blockquote className="border-l-[3px] border-session-verse-border pl-3.5 text-[15px] font-light italic leading-relaxed text-session-verse-text">
                {block.text}
              </blockquote>
            ) : null}
            {block.reason ? (
              <p className="text-xs font-normal leading-relaxed text-scriba-ink-soft">
                {block.reason}
              </p>
            ) : null}
          </div>
        </details>
      );
    }
    default:
      return null;
  }
}
