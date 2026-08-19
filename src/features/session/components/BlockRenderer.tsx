import { BookOpen } from "lucide-react";
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
    case "bibleQuote":
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
          {block.text ? (
            <blockquote className="pl-3 text-sm leading-relaxed text-foreground/90">
              {block.text}
            </blockquote>
          ) : null}
        </figure>
      );
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
