import { BookGlyph } from "@/components/icons/BookGlyph";
import { PassageVerses } from "@/features/session/components/PassageVerses";
import { parseVerseReference } from "@/lib/domain/feed";
import type { SummaryBlock } from "@/lib/domain/summary";

function PenaAvatar() {
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
        <aside className="relative rounded-2xl border-l-4 border-[#D7DFE7] bg-[#EEF3FB] px-5 py-4">
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
