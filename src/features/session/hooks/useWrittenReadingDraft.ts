"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { revealSummaryBlock } from "@/features/session/components/reveal-block";
import {
  insertionIndex,
  payloadToWritten,
  type SummaryPayload,
  type WrittenBlock,
  type WrittenSummary,
} from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";

const log = createLogger("written-reading-draft");

/**
 * Escrever num resumo já SALVO, sem rascunho local — a metade que
 * `useWrittenDraft` não cobre.
 *
 * `/summary/new` guarda um rascunho no IndexedDB e sincroniza a cada 1,8s; aqui
 * não há aparelho para guardar nada, o texto que está na tela veio do
 * servidor num render, e escrever nele é um `POST /api/sessions/written` mais
 * um `router.refresh()`. **É o mesmo POST que o editor usa**, e isso só é
 * possível porque aquela rota deixou de exigir sessão `manual` — ela salva o
 * resumo de qualquer modo.
 *
 * Extraído de `BibloSummaryDock` para ter UM dono: o Biblo da leitura e o
 * botão "Adicionar ao resumo" do diálogo de referência (`ChapterDialog`, via
 * `SummaryInsertContext`) escrevem no MESMO documento, e duas instâncias
 * deste hook divergiriam — cada uma acha que sabe o estado atual dos blocos,
 * e a segunda escrita apagaria a primeira.
 */
export function useWrittenReadingDraft({
  sessionId,
  summary,
  title,
}: {
  sessionId: string;
  summary: SummaryPayload | null;
  /** O título da COLUNA, que é o que a tela mostra. Ver `BibloSummaryDock`. */
  title: string;
}) {
  const router = useRouter();

  /**
   * O ÍNDICE do bloco que acabou de ser inserido, esperando o servidor
   * devolver a tela com ele dentro para poder piscar.
   *
   * **Aqui a revelação não pode ser no ato.** Inserir é um POST mais um
   * `router.refresh()`, e até ele voltar o nó naquele índice ainda é o bloco
   * ANTIGO. Piscar na hora piscaria o parágrafo errado.
   */
  const pendingReveal = useRef<number | null>(null);

  /**
   * A última versão do resumo que este hook já viu.
   *
   * `summary` desce do server component, então **uma IDENTIDADE nova é o
   * `router.refresh()` chegando** — um re-render de cliente passa o mesmo
   * objeto. É esse o sinal que a revelação espera.
   *
   * **Comparar o CONTEÚDO do bloco não funciona, e a razão é o banco.**
   * `final_summary` é `jsonb`, e o Postgres não preserva a ordem das chaves
   * de um objeto: o que sai como `{type, text}` volta como `{text, type}`.
   */
  const seenSummary = useRef(summary);

  useEffect(() => {
    if (summary === seenSummary.current) return;
    seenSummary.current = summary;

    const at = pendingReveal.current;
    if (at === null) return;
    pendingReveal.current = null;
    revealSummaryBlock(at);
  }, [summary]);

  // O payload em edição fica numa ref, não em estado: quem desenha o resumo é
  // o server component atrás da tela, e `router.refresh()` o repinta. Um
  // estado aqui seria uma segunda cópia do mesmo texto, e as duas divergiriam
  // no primeiro refresh.
  const draft = useRef<WrittenSummary>({
    ...payloadToWritten(summary),
    title,
  });

  async function save(next: WrittenSummary) {
    draft.current = next;
    try {
      const res = await fetch("/api/sessions/written", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: sessionId, summary: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch (error) {
      log.error("não consegui salvar o bloco", { error: String(error) });
    }
  }

  /**
   * Insere `block` na posição pedida, respeitando o teto da conclusão (ver
   * `insertionIndex`). `requestedIndex` é passado direto para ela — quem
   * quiser inserir no FIM do texto manda `BIBLO_AT_END`
   * (`Number.MAX_SAFE_INTEGER`, de `lib/domain/biblo.ts`).
   */
  function addBlock(block: WrittenBlock, requestedIndex: number) {
    const blocks = draft.current.blocks.slice();
    const at = insertionIndex(blocks, block, requestedIndex);
    blocks.splice(at, 0, block);
    pendingReveal.current = at;
    void save({ ...draft.current, blocks });
  }

  /** Remove a ÚLTIMA ocorrência igual a `block`, e não um índice guardado: o
   *  documento pode ter mudado entre a sugestão e o desfazer dela. */
  function removeBlock(block: WrittenBlock) {
    const needle = JSON.stringify(block);
    const serialized = draft.current.blocks.map((b) => JSON.stringify(b));
    const at = serialized.lastIndexOf(needle);
    if (at < 0) return;
    void save({
      ...draft.current,
      blocks: draft.current.blocks.filter((_, i) => i !== at),
    });
  }

  return { addBlock, removeBlock };
}
