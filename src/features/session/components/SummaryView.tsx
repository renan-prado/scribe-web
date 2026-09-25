"use client";

import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { LeadIdea } from "@/features/session/components/LeadIdea";
import { SUMMARY_BLOCK_ATTR } from "@/features/session/components/reveal-block";
import { SummaryEmptyState } from "@/features/session/components/SummaryEmptyState";
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
  /**
   * A sessão a que este resumo pertence. Serve a um caso só: sem resumo
   * nenhum, é o que deixa o estado vazio oferecer a saída. O `/admin` monta
   * esta view sem ele. Ver `SummaryEmptyState`.
   */
  sessionId?: string;
  /** Refazer o resumo a partir da transcrição, quando ele falhou. Ver `SummaryEmptyState`. */
  onGenerate?: () => void;
  generating?: boolean;
};

export function SummaryView({
  summary,
  hasTranscript,
  running,
  sessionId,
  onGenerate,
  generating,
}: SummaryViewProps) {
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
            // O índice vai no DOM para a inserção pela conversa poder ROLAR até
            // o bloco e piscar nele. É a mesma numeração que
            // `suggestion.afterIndex` usa, e ela é fiel porque este `map` é
            // um-para-um com `blocks` — um filtro aqui a desalinharia em
            // silêncio. Ver `revealSummaryBlock`.
            <div
              key={key}
              {...{ [SUMMARY_BLOCK_ATTR]: i }}
              className="animate-content-fade min-w-0"
            >
              <BlockRenderer block={block} />
            </div>
          );
        })}
      </div>
    );
  }
  // O esqueleto responde só a `running`, e não mais a `running ||
  // hasTranscript`. A sessão salva NUNCA está `running` (as duas telas que
  // montam esta view passam `false`), então "tem transcrição e não tem resumo"
  // caía num esqueleto que nunca resolvia: o resumo falhou e não vem mais.
  // Quem desenha aquele caso agora é o `SummaryEmptyState`, que sabe a
  // diferença entre "não há de onde tirar resumo" e "o resumo falhou".
  if (running) {
    return <SummarySkeleton />;
  }
  // Sessão salva e PARADA sem resumo: ou não há nada escrito nela, ou há a
  // transcrição e o resumo é que não saiu.
  return (
    <SummaryEmptyState
      sessionId={sessionId}
      hasTranscript={hasTranscript}
      onGenerate={onGenerate}
      generating={generating}
    />
  );
}
