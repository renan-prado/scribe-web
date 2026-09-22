"use client";

import { BibloDock } from "@/features/session/components/BibloDock";
import { useSummaryInsert } from "@/features/session/components/SummaryInsertContext";
import type { BibloSuggestion } from "@/lib/domain/biblo";
import type { WrittenBlock } from "@/lib/domain/summary";

/**
 * O Biblo na tela de LEITURA, onde inserir um bloco custa uma ida ao servidor.
 *
 * A escrita em si — `POST /api/sessions/written`, o `insertionIndex` que
 * respeita o teto da conclusão, e a revelação do bloco depois do
 * `router.refresh()` — mora em `useWrittenReadingDraft`, e chega até aqui por
 * `useSummaryInsert()`: a MESMA instância que o botão "Adicionar ao resumo"
 * do diálogo de referência usa. Um `sessionId` que se acha dono de uma cópia
 * própria do `draft` divergiria da leitura de verdade a cada inserção — por
 * isso este componente sempre monta DENTRO de um `SummaryInsertProvider`
 * (ver `/summary/[id]/page.tsx`), e não chama o hook por conta própria.
 */
export function BibloSummaryDock({ sessionId }: { sessionId: string }) {
  const insert = useSummaryInsert();

  return (
    <BibloDock
      sessionId={sessionId}
      onInsert={(suggestion: BibloSuggestion) => {
        // A conclusão é o TETO, e nada entra abaixo dela: `insertionIndex`
        // (chamado dentro de `addBlock`) grampeia `afterIndex + 1` ali.
        insert?.addBlock(suggestion.block as WrittenBlock, suggestion.afterIndex + 1);
      }}
      onRemove={(suggestion: BibloSuggestion) => {
        // A ÚLTIMA ocorrência igual à sugerida, e não um índice guardado: o
        // mesmo raciocínio do editor. Ver `Composer`.
        insert?.removeBlock(suggestion.block as WrittenBlock);
      }}
    />
  );
}
