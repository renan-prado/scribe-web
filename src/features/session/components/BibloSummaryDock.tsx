"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BibloDock } from "@/features/session/components/BibloDock";
import { revealSummaryBlock } from "@/features/session/components/reveal-block";
import type { BibloSuggestion } from "@/lib/domain/biblo";
import {
  payloadToWritten,
  type SummaryPayload,
  type WrittenBlock,
  type WrittenSummary,
} from "@/lib/domain/summary";
import { createLogger } from "@/lib/log";

const log = createLogger("biblo");

/**
 * O Biblo na tela de LEITURA, onde inserir um bloco custa uma ida ao servidor.
 *
 * No editor a sugestão entra no rascunho local e o salvamento automático a leva
 * ao banco. Aqui não há rascunho: `/summary` é leitura, o texto que está na
 * tela veio do servidor, e escrever nele é um POST.
 *
 * **O POST é o mesmo `/api/sessions/written` que o editor usa**, e isso só é
 * possível porque aquela rota deixou de exigir sessão `manual` — ela salva o
 * resumo de qualquer modo, pelo mesmo motivo que `/escrever/:id` abre qualquer
 * modo (o vocabulário do editor virou o do resumo inteiro). Enquanto o
 * `409 not_manual` existia, o Biblo daqui não teria onde escrever.
 *
 * **O título vem da COLUNA, não do payload.** Os dois existem, e renomear em
 * `/summary` escreve só a coluna; mandar de volta o `final_summary.title`
 * antigo faria a próxima abertura do editor mostrar o nome anterior. É a mesma
 * armadilha documentada em `escrever/[id]/page.tsx`, do outro lado.
 */
export function BibloSummaryDock({
  sessionId,
  summary,
  title,
}: {
  sessionId: string;
  summary: SummaryPayload | null;
  /** O título da COLUNA, que é o que a tela mostra. */
  title: string;
}) {
  const router = useRouter();

  /**
   * O ÍNDICE do bloco que acabou de ser inserido, esperando o servidor devolver
   * a tela com ele dentro para poder piscar.
   *
   * **Aqui a revelação não pode ser no ato, e é a diferença desta tela.** No
   * editor o bloco entra num rascunho local e existe no quadro seguinte; aqui
   * inserir é um POST mais um `router.refresh()`, e até ele voltar o nó naquele
   * índice ainda é o bloco ANTIGO. Piscar na hora piscaria o parágrafo errado.
   */
  const pendingReveal = useRef<number | null>(null);

  /**
   * A última versão do resumo que esta gaveta já viu.
   *
   * O `summary` desce do server component, então **uma IDENTIDADE nova é o
   * `router.refresh()` chegando** — um re-render de cliente passa o mesmo
   * objeto. É esse o sinal que a revelação espera.
   *
   * **Comparar o CONTEÚDO do bloco não funciona, e a razão é o banco.**
   * `final_summary` é `jsonb`, e o Postgres não preserva a ordem das chaves de
   * um objeto: o que sai como `{type, text}` volta como `{text, type}`. Um
   * `JSON.stringify` dos dois lados compara duas grafias da mesma coisa e
   * responde "diferente" para sempre — na prática a piscada não acontecia em
   * NENHUM bloco desta tela, e a única pista era a ausência dela.
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

  // O payload em edição fica numa ref, não em estado: quem desenha o resumo é o
  // server component atrás da gaveta, e `router.refresh()` o repinta. Um estado
  // aqui seria uma segunda cópia do mesmo texto, e as duas divergiriam no
  // primeiro refresh.
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

  return (
    <BibloDock
      sessionId={sessionId}
      onInsert={(suggestion: BibloSuggestion) => {
        const blocks = draft.current.blocks.slice();
        const at = Math.min(Math.max(suggestion.afterIndex + 1, 0), blocks.length);
        blocks.splice(at, 0, suggestion.block as WrittenBlock);
        pendingReveal.current = at;
        void save({ ...draft.current, blocks });
      }}
      onRemove={(suggestion: BibloSuggestion) => {
        // A ÚLTIMA ocorrência igual à sugerida, e não um índice guardado: o
        // mesmo raciocínio do editor. Ver `Composer`.
        const needle = JSON.stringify(suggestion.block);
        const serialized = draft.current.blocks.map((b) => JSON.stringify(b));
        const at = serialized.lastIndexOf(needle);
        if (at < 0) return;
        void save({
          ...draft.current,
          blocks: draft.current.blocks.filter((_, i) => i !== at),
        });
      }}
    />
  );
}
