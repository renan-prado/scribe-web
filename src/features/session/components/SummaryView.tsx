"use client";

import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { LeadIdea } from "@/features/session/components/LeadIdea";
import { SummarySkeleton } from "@/features/session/components/skeletons";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * Renders the final summary produced by /api/final-summary. Purely presentational,
 * the page decides when to mount it (only after the recording has stopped and the
 * final payload has arrived).
 *
 * A lista é PLANA. Houve um agrupamento aqui, cada bloco primário casado com os
 * comentários do Scriba que vinham depois dele e um botão de balão à direita
 * abrindo o popover. Os comentários saíram do produto inteiro (ver
 * `lib/domain/summary.ts`), e com eles o agrupamento, o botão e o placeholder
 * invisível que reservava a largura dele para alinhar as linhas.
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
        <LeadIdea label="Ideia central" text={summary!.shortSummary} />
        {summary!.blocks.map((block, i) => {
          // A posição entra na chave de propósito: dois `highlight` com o
          // mesmo começo de texto existem, e `blockKey` sozinho os colidiria.
          const key = `${block.type}-${i}-${blockKey(block)}`;
          return (
            <div key={key} className="animate-content-fade min-w-0">
              <BlockRenderer block={block} />
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
