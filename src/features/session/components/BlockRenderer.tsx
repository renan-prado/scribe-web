import { BookOpen } from "lucide-react";
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
        <h2 className="mt-4 font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
          {block.text}
        </h2>
      );
    case "h2":
      return (
        <h3 className="mt-4 font-heading text-xl font-bold leading-snug tracking-tight text-foreground">
          {block.text}
        </h3>
      );
    case "paragraph":
      return <p className="text-pretty text-base leading-relaxed text-foreground">{block.text}</p>;
    case "example":
      return (
        <aside className="relative rounded-2xl border-l-4 border-foreground/25 bg-muted/40 py-4 pr-5 pl-5">
          <span className="mb-1.5 block text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
            Exemplo do pregador
          </span>
          <p className="text-pretty text-[0.95rem] leading-relaxed text-foreground/90">
            {block.text}
          </p>
        </aside>
      );
    case "bibleQuote": {
      // Parse the range so we can render each verse as its own numbered
      // paragraph (Bible-app style). Falls back to the LLM-provided monolithic
      // text for chapter-only refs or unparseable references, where per-verse
      // fetch would either explode (whole chapter) or fail (bad ref).
      const parsed = parseVerseReference(block.reference);
      const hasRange = parsed && parsed.startVerse != null && parsed.endVerse != null;
      return (
        <figure
          className="relative flex flex-col gap-5 rounded-3xl border border-border p-7 animate-insight-gradient"
          style={{
            backgroundImage: "var(--session-surface-quote)",
            backgroundSize: "200% 200%",
          }}
        >
          <figcaption>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-semibold text-background">
              <BookOpen className="size-3" />
              {block.reference}
            </span>
          </figcaption>
          {hasRange ? (
            <PassageVerses
              bookDisplay={parsed.bookDisplay}
              chapter={parsed.chapter}
              startVerse={parsed.startVerse as number}
              endVerse={parsed.endVerse as number}
            />
          ) : block.text ? (
            <blockquote className="pl-3 text-sm leading-relaxed text-foreground/90">
              {block.text}
            </blockquote>
          ) : null}
        </figure>
      );
    }
    case "highlight":
      return (
        <figure className="my-4 px-4 text-center sm:px-8">
          <blockquote className="text-pretty text-lg font-semibold leading-loose tracking-tight text-foreground sm:text-xl">
            <span
              aria-hidden
              className="mr-3 select-none align-[-0.25em] font-heading text-4xl leading-none text-muted-foreground/30"
            >
              ❝
            </span>
            <span className="bg-[var(--session-highlight-yellow)] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {block.text}
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
    case "conclusion":
      return (
        <section
          className="relative mt-4 flex flex-col gap-5 rounded-3xl border border-border p-7 animate-insight-gradient"
          style={{
            backgroundImage: "var(--session-surface-quote)",
            backgroundSize: "200% 200%",
          }}
        >
          <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
            Conclusão
          </span>
          <p className="text-pretty text-base leading-relaxed text-foreground">{block.text}</p>
        </section>
      );
    case "quote":
      return (
        <figure className="border-l-2 border-border pl-4">
          <blockquote className="text-base italic leading-relaxed text-foreground/80">
            {block.text}
          </blockquote>
          {block.author ? (
            <figcaption className="mt-1 text-xs text-muted-foreground">— {block.author}</figcaption>
          ) : null}
        </figure>
      );
    default:
      return null;
  }
}
