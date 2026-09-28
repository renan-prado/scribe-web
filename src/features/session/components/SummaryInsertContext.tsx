"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useWrittenReadingDraft } from "@/features/session/hooks/useWrittenReadingDraft";
import type { TranslationId } from "@/lib/bibles/translations";
import { BIBLO_AT_END } from "@/lib/domain/biblo";
import type { SummaryPayload, WrittenBlock } from "@/lib/domain/summary";

export type SummaryInsertApi = {
  addBlock: (block: WrittenBlock, requestedIndex: number) => void;
  removeBlock: (block: WrittenBlock) => void;
  /** Acrescenta uma REFERÊNCIA como bloco de Bíblia, no fim do texto (antes
   *  da conclusão, se houver uma — ver `insertionIndex`). */
  addPassage: (reference: string, translation?: TranslationId) => void;
  /**
   * Várias referências de uma vez, numa escrita só — é o que a escolha de
   * versículos manda, uma faixa por trecho contíguo (ver `VerseSelection`).
   *
   * `translation` é a ESCOLHIDA no toque da pastilha, e só ela: gravar a
   * preferência de quem lê congelaria o bloco numa tradução que ninguém pediu.
   */
  addPassages: (references: string[], translation?: TranslationId) => void;
};

/** Um bloco de Bíblia a partir da referência, com a tradução só quando há uma. */
function passageBlock(reference: string, translation?: TranslationId): WrittenBlock {
  return { type: "bibleQuote", reference, text: "", ...(translation ? { translation } : {}) };
}

const SummaryInsertContext = createContext<SummaryInsertApi | null>(null);

/**
 * Quem pode escrever no resumo ABERTO, sem sair da tela de leitura.
 *
 * Existe para uma ÚNICA instância de `useWrittenReadingDraft` (o `draft` e o
 * `POST /api/sessions/written`) ser compartilhada por dois caminhos que hoje
 * inserem bloco na leitura: o Biblo (`BibloSummaryDock`) e o botão "Adicionar
 * ao resumo" do diálogo de referência (`ChapterDialog`). Duas instâncias
 * separadas — cada uma com o próprio `draft.current` — escreveriam sobre o
 * mesmo documento sem se enxergar: a segunda escrita apagaria a primeira.
 *
 * Monta em `/summary/[id]/page.tsx`, envolvendo `SavedSessionView` E
 * `BibloSummaryDock`. Fora dele (a landing, que não tem provider nenhum)
 * `useSummaryInsert()` devolve `null`, e quem consome — o `ChapterDialog`, a
 * Bíblia da lateral — simplesmente não mostra o botão nem arma o toque longo.
 *
 * **No EDITOR quem monta o contexto é o `Composer`**, com o `SummaryInsertScope`
 * logo abaixo, e não este provider: lá o documento é o rascunho dele, com
 * desfazer, foco e revelação próprios, e um segundo dono do mesmo texto era
 * exatamente o problema que este arquivo existe para não ter. O que o contexto
 * garante é que a Bíblia da lateral não precise saber em qual das duas telas
 * está montada.
 */
export function SummaryInsertProvider({
  sessionId,
  summary,
  title,
  children,
}: {
  sessionId: string;
  summary: SummaryPayload | null;
  title: string;
  children: ReactNode;
}) {
  const { addBlock, addBlocks, removeBlock } = useWrittenReadingDraft({
    sessionId,
    summary,
    title,
  });

  const api: SummaryInsertApi = {
    addBlock,
    removeBlock,
    addPassage: (reference, translation) =>
      addBlocks([passageBlock(reference, translation)], BIBLO_AT_END),
    addPassages: (references, translation) =>
      addBlocks(
        references.map((reference) => passageBlock(reference, translation)),
        BIBLO_AT_END
      ),
  };

  return <SummaryInsertScope api={api}>{children}</SummaryInsertScope>;
}

/**
 * O contexto COM a implementação já pronta, para quem já é dono do documento.
 *
 * É por aqui que o editor entra: ele não tem — nem pode ter — um
 * `useWrittenReadingDraft`, porque o texto dele é um rascunho local com
 * desfazer e foco. O que ele empresta é a mesma API, ligada ao `insertAt` dele.
 */
export function SummaryInsertScope({
  api,
  children,
}: {
  api: SummaryInsertApi;
  children: ReactNode;
}) {
  return <SummaryInsertContext.Provider value={api}>{children}</SummaryInsertContext.Provider>;
}

export function useSummaryInsert(): SummaryInsertApi | null {
  return useContext(SummaryInsertContext);
}
