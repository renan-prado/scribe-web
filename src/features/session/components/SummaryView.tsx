"use client";

import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { SummarySkeleton } from "@/features/session/components/skeletons";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * Renders the final summary produced by /api/final-summary. Purely presentational —
 * the page decides when to mount it (only after the recording has stopped and the
 * final payload has arrived).
 */
type SummaryViewProps = {
  summary: SummaryPayload | null;
  hasTranscript: boolean;
  running: boolean;
};

export function SummaryView({ summary, hasTranscript, running }: SummaryViewProps) {
  const hasBody = summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0);

  if (hasBody) {
    return (
      <div className="flex flex-col gap-7">
        {summary!.shortSummary ? (
          <div className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-ink-soft pl-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
              Ideia central
            </span>
            <p
              key={summary!.shortSummary}
              className="animate-content-fade text-pretty text-lg font-medium leading-snug text-scriba-ink-strong text-balance"
            >
              {summary!.shortSummary}
            </p>
          </div>
        ) : null}
        {summary!.blocks.map((block, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: index disambiguates blocks whose type + content hash collide (e.g., two short paragraphs starting the same way)
            key={`${block.type}-${i}-${blockKey(block)}`}
            className="animate-content-fade"
          >
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>
    );
  }
  if (running || hasTranscript) {
    return <SummarySkeleton />;
  }
  return <p className="text-sm font-light text-scriba-ink-mute">O resumo aparecerá aqui.</p>;
}
