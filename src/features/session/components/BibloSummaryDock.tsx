"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { BibloDock } from "@/features/session/components/BibloDock";
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
