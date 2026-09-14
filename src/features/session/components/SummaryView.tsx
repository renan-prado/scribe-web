"use client";

import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { SummarySkeleton } from "@/features/session/components/skeletons";
import type { SummaryPayload } from "@/lib/domain/summary";
import { ScribaMark } from "@/shared/brand";

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
   * Como a IDEIA CENTRAL é desenhada.
   *
   * - `"rule"` (padrão): filete à esquerda e texto solto, o resumo de hoje.
   * - `"card"` (o `/summary`): o mesmo cartão do bloco `conclusion`, com a
   *   superfície em degradê e a marca do Scriba na pastilha. As duas frases
   *   que a IA escreve SOBRE o sermão, e não a partir dele, passam a ter a
   *   mesma roupa, uma abrindo e a outra fechando a leitura.
   */
  lead?: "rule" | "card";
};

export function SummaryView({ summary, hasTranscript, running, lead = "rule" }: SummaryViewProps) {
  const hasBody = summary && (summary.shortSummary.length > 0 || summary.blocks.length > 0);

  if (hasBody) {
    return (
      <div className="flex flex-col gap-7">
        {summary!.shortSummary && lead === "card" ? (
          <section className="animate-insight-gradient relative flex flex-col gap-3 rounded-[26px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-6">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-session-chip-ai">
              <ScribaMark className="size-3" />
              Ideia central
            </span>
            {/* Corpo nas MESMAS medidas do bloco `conclusion`
                (`text-[15px] font-light leading-[1.7]`): se as duas têm a
                mesma roupa, ter tamanhos diferentes faria uma parecer mais
                importante que a outra. Quem dá destaque à abertura é o lugar
                dela, no topo, não o corpo da letra. */}
            <p
              key={summary!.shortSummary}
              className="animate-content-fade text-pretty text-[15px] font-light leading-[1.7] text-session-verse-text"
            >
              {summary!.shortSummary}
            </p>
          </section>
        ) : summary!.shortSummary ? (
          <div className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-ink-soft pl-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
              Ideia central
            </span>
            <p
              key={summary!.shortSummary}
              className="animate-content-fade text-pretty text-lg font-normal leading-snug text-scriba-ink-strong text-balance"
            >
              {summary!.shortSummary}
            </p>
          </div>
        ) : null}
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
