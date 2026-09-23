"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useWrittenReadingDraft } from "@/features/session/hooks/useWrittenReadingDraft";
import { BIBLO_AT_END } from "@/lib/domain/biblo";
import type { SummaryPayload, WrittenBlock } from "@/lib/domain/summary";

type SummaryInsertApi = {
  addBlock: (block: WrittenBlock, requestedIndex: number) => void;
  removeBlock: (block: WrittenBlock) => void;
  /** Acrescenta uma REFERÊNCIA como bloco de Bíblia, no fim do texto (antes
   *  da conclusão, se houver uma — ver `insertionIndex`). */
  addPassage: (reference: string) => void;
};

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
 * `useSummaryInsert()` devolve `null`, e quem consome — hoje só o
 * `ChapterDialog` — simplesmente não mostra o botão.
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
  const { addBlock, removeBlock } = useWrittenReadingDraft({ sessionId, summary, title });

  const api: SummaryInsertApi = {
    addBlock,
    removeBlock,
    addPassage: (reference) => addBlock({ type: "bibleQuote", reference, text: "" }, BIBLO_AT_END),
  };

  return <SummaryInsertContext.Provider value={api}>{children}</SummaryInsertContext.Provider>;
}

export function useSummaryInsert(): SummaryInsertApi | null {
  return useContext(SummaryInsertContext);
}
