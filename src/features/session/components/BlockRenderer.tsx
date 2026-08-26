import { BookGlyph } from "@/components/icons/BookGlyph";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { parseVerseReference } from "@/lib/domain/feed";
import type { SummaryBlock } from "@/lib/domain/summary";

export function blockKey(block: SummaryBlock): string {
  if (block.type === "bibleQuote") return `${block.reference}-${block.text.slice(0, 24)}`;
  if (block.type === "quote") return `${block.text.slice(0, 24)}-${block.author ?? ""}`;
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
        <aside className="relative rounded-2xl border-l-4 border-[#D7DFE7] bg-[#F5F8FB] px-5 py-4">
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
        <figure className="my-2 flex flex-col items-center gap-1.5 px-4 text-center sm:px-8">
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
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
    default:
      return null;
  }
}
