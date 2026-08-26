"use client";

import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { type CommentBlock, ScribaCommentGroup } from "@/features/session/components/ScribaComment";
import { SummarySkeleton } from "@/features/session/components/skeletons";
import type { SummaryBlock, SummaryPayload } from "@/lib/domain/summary";

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

type BlockGroup = { primary: SummaryBlock; comments: CommentBlock[] };

function isCommentBlock(b: SummaryBlock): b is CommentBlock {
  return b.type === "contextCard" || b.type === "relatedVerse";
}

/**
 * Groups each Scriba comment (contextCard/relatedVerse) with the preceding
 * primary block. Orphan comments (comment appears before any primary) render
 * standalone as their own group.
 */
function groupBlocks(blocks: SummaryBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  for (const b of blocks) {
    if (isCommentBlock(b)) {
      const last = groups[groups.length - 1];
      if (last && !isCommentBlock(last.primary)) {
        last.comments.push(b);
        continue;
      }
    }
    groups.push({ primary: b, comments: [] });
  }
  return groups;
}

export function SummaryView({ summary, hasTranscript, running }: SummaryViewProps) {
  const hasBody = summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0);

  if (hasBody) {
    const groups = groupBlocks(summary!.blocks);
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
        {groups.map((g, i) => {
          const key = `${g.primary.type}-${i}-${blockKey(g.primary)}`;
          if (g.comments.length > 0) {
            return (
              <div key={key} className="animate-content-fade">
                <ScribaCommentGroup comments={g.comments}>
                  <BlockRenderer block={g.primary} />
                </ScribaCommentGroup>
              </div>
            );
          }
          return (
            <div key={key} className="animate-content-fade">
              <BlockRenderer block={g.primary} />
            </div>
          );
        })}
      </div>
    );
  }
  if (running || hasTranscript) {
    return <SummarySkeleton />;
  }
  return <p className="text-sm font-light text-scriba-ink-mute">O resumo aparecerá aqui.</p>;
}
