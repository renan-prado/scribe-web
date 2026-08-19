"use client";

import { useMemo } from "react";
import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { InsightRenderer } from "@/features/session/components/InsightRenderer";
import { SummarySkeleton } from "@/features/session/components/skeletons";
import type { Insight } from "@/lib/domain/insights";
import type { SummaryPayload } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";

export function SummaryView({
  summary,
  insights,
  pendingIndices,
  hasTranscript,
  running,
}: {
  summary: SummaryPayload | null;
  insights: Insight[];
  pendingIndices: Set<number>;
  hasTranscript: boolean;
  running: boolean;
}) {
  const hasBody = summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0);
  const hasThinking = summary && summary.thinking.length > 0;
  const insightsByBlock = useMemo(() => {
    const map = new Map<number, Insight[]>();
    for (const ins of insights) {
      const list = map.get(ins.targetBlockIndex) ?? [];
      list.push(ins);
      map.set(ins.targetBlockIndex, list);
    }
    return map;
  }, [insights]);

  if (hasBody || hasThinking) {
    return (
      <div className="flex flex-col gap-8">
        {hasBody && summary!.shortSummary ? (
          <div className="-mb-2 flex flex-col gap-2 border-l-2 border-foreground/60 pl-4">
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
              Ideia central
            </span>
            <p
              key={summary!.shortSummary}
              className="animate-content-fade text-pretty text-lg font-medium leading-snug text-foreground text-balance"
            >
              {summary!.shortSummary}
            </p>
          </div>
        ) : null}
        {hasBody
          ? summary!.blocks.map((block, i) => {
              const attached = insightsByBlock.get(i) ?? [];
              const pulsing = pendingIndices.has(i);
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: index disambiguates blocks whose type + content hash collide (e.g., two short paragraphs starting the same way)
                  key={`${block.type}-${i}-${blockKey(block)}`}
                  className={cn("animate-content-fade", pulsing && "animate-consolidate-pulse")}
                >
                  <BlockRenderer block={block} />
                  {attached.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-3">
                      {attached.map((ins, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: insight order is stable within a fetch
                        <InsightRenderer key={`${ins.type}-${j}`} insight={ins} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
        {!hasBody ? <SummarySkeleton /> : null}
      </div>
    );
  }
  if (running || hasTranscript) {
    return <SummarySkeleton />;
  }
  return <p className="text-sm text-muted-foreground">O resumo aparecerá aqui.</p>;
}
