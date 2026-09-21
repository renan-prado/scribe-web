"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBibloWriter } from "@/features/session/biblo-query";
import {
  ACTION_LABELS,
  type BibloDoc,
  type BibloWorkspace,
  EMPTY_WORKSPACE,
  ensureWorkspaceSession,
  readWorkspace,
  runBibloAction,
  writeWorkspace,
} from "@/features/session/biblo-workspace";
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { useLibraryWriter } from "@/features/session/query";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { BibloAction } from "@/lib/domain/biblo";
import { BibloAvatar } from "@/shared/brand";

/**
 * O Biblo na BIBLIOTECA, onde ele não conversa sobre um texto: ele ESCREVE um.
 *
 * ## O que muda em relação ao Biblo de dentro de uma sessão
 *
 * Lá há um documento na tela, e a porta para ele é a `suggestion`: um bloco,
 * inserido onde o modelo apontou. Aqui não há documento nenhum, e uma sugestão
 * de bloco não teria onde entrar. No lugar dela vêm as FERRAMENTAS — criar um
 * documento, renomeá-lo, acrescentar conteúdo — pedidas ao modelo pelo
 * `BIBLO_TOOLS_BLOCK` e executadas AQUI, no cliente.
 *
 * **Executar no cliente não é preguiça, é onde a permissão já existe.** Quem
 * escreve é `/api/sessions/written`, a mesma rota do editor, que confere dono
 * e passa pela RLS. A alternativa seria uma rota nova que escreve no acervo a
 * partir do que um modelo devolveu, o que é exatamente a rota que ninguém
 * quer ter.
 *
 * ## Duas sessões, e elas não se confundem
 *
 * A conversa se ancora numa sessão VAZIA que nunca é encerrada (e por isso
 * nunca aparece no acervo); o documento que o Biblo cria é outra sessão, modo
 * `manual`, que aparece como qualquer resumo escrito à mão. O porquê inteiro
 * está em `biblo-workspace.ts`.
 *
 * ## O botão
 *
 * O mesmo disco de vidro do Biblo das outras telas, no mesmo canto. O que muda
 * é a companhia: aqui o canto de baixo à direita já é do `+` do `CreateDock`
 * no celular, então este sobe uma linha — o `+` é a ação principal da tela e
 * não pode pular de lugar, pela mesma regra que já governa o `BackToTop` do
 * `/summary`.
 */
export function BibloHomeDock() {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [workspace, setWorkspace] = useState<BibloWorkspace>(EMPTY_WORKSPACE);
  const library = useLibraryWriter();
  useKeyboardInset();

  // O `localStorage` só existe no cliente, e lê-lo durante o render faria o
  // servidor desenhar uma coisa e o navegador outra. Um quadro depois, como a
  // vista da Biblioteca e o resto do app.
  useEffect(() => setWorkspace(readWorkspace()), []);

  const { prefetch } = useBibloWriter(workspace.sessionId ?? "");
  useEffect(() => {
    if (workspace.sessionId) prefetch();
  }, [prefetch, workspace.sessionId]);

  const ensureSession = useCallback(async () => {
    const id = await ensureWorkspaceSession();
    if (id) setWorkspace((w) => ({ ...w, sessionId: id }));
    return id;
  }, []);

  const runActions = useCallback(
    async (actions: BibloAction[], onStep: (label: string) => void) => {
      let doc: BibloDoc | null = readWorkspace().doc;
      let created = false;
      for (const action of actions) {
        onStep(ACTION_LABELS[action.tool]);
        const outcome = await runBibloAction(action, doc);
        // `null` é a ação que não tinha para onde ir (renomear sem documento);
        // `ok: false` é o salvamento que falhou. Nos dois a conversa segue: a
        // resposta do Biblo já está paga, e derrubá-la por causa de um POST
        // seria cobrar duas vezes pela mesma pergunta.
        if (!outcome?.ok) continue;
        doc = outcome.doc;
        created = created || outcome.created;
      }
      setWorkspace((w) => {
        const next = { ...w, doc };
        writeWorkspace(next);
        return next;
      });
      // O acervo guardado no aparelho não conhece o documento que acabou de
      // nascer, e a Biblioteca está bem atrás desta gaveta.
      if (created) void library.invalidate();
    },
    [library]
  );

  const banner = workspace.doc ? (
    <div className="flex items-center gap-2 rounded-xl bg-scriba-hairline/40 px-3 py-2">
      <FileText aria-hidden className="size-3.5 shrink-0 text-scriba-ink-mute" strokeWidth={1.75} />
      <Link
        href={`/escrever/${workspace.doc.id}`}
        className="min-w-0 flex-1 truncate text-[12.5px] text-scriba-ink-soft underline-offset-2 hover:text-scriba-ink hover:underline"
      >
        {workspace.doc.title}
      </Link>
      <button
        type="button"
        onClick={() => {
          setWorkspace((w) => {
            const next = { ...w, doc: null };
            writeWorkspace(next);
            return next;
          });
        }}
        aria-label="Parar de editar este documento"
        title="O próximo pedido cria um documento novo"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:bg-scriba-hairline/60 hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute"
      >
        <X aria-hidden className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* O botão sai da tela com a gaveta aberta: ele não é um interruptor
          aceso, ele VIROU a gaveta. `bottom` empilha acima do `+` do
          `CreateDock`, que é a ação principal do `/home` e não pode se mexer. */}
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-[calc(5.5rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))] md:pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Conversar com o Biblo"
            aria-expanded={false}
            className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute"
          >
            <BibloAvatar mood={thinking ? "thinking" : "idle"} size={36} />
          </button>
        </div>
      )}

      {open && (
        <BibloDrawer
          surface="home"
          sessionId={workspace.sessionId ?? ""}
          ensureSession={ensureSession}
          onActions={runActions}
          banner={banner}
          onClose={() => setOpen(false)}
          onThinking={setThinking}
        />
      )}
    </>
  );
}
