"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { useBibloWriter } from "@/features/session/biblo-query";
import {
  ACTION_LABELS,
  type BibloDoc,
  type BibloWorkspace,
  EMPTY_WORKSPACE,
  ensureWorkspaceSession,
  navigationTargetFor,
  readWorkspace,
  runBibloAction,
  writeWorkspace,
} from "@/features/session/biblo-workspace";
import type { BibloDockHandle } from "@/features/session/components/BibloDock";
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { useLibraryWriter } from "@/features/session/query";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { BibloAction } from "@/lib/domain/biblo";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";

const log = createLogger("biblo-home");

/**
 * O Biblo na BIBLIOTECA, onde ele não conversa sobre um texto: ele ESCREVE um.
 *
 * ## O que muda em relação ao Biblo de dentro de uma sessão
 *
 * Lá há um documento na tela, e a porta para ele é a `suggestion`: um bloco,
 * inserido onde o modelo apontou. Aqui não há documento nenhum, e uma sugestão
 * de bloco não teria onde entrar. No lugar dela vêm as FERRAMENTAS — criar um
 * documento, renomeá-lo, acrescentar conteúdo, gravar, importar do YouTube,
 * navegar — pedidas ao modelo pelo `BIBLO_TOOLS_BLOCK` e executadas AQUI, no
 * cliente.
 *
 * **Executar no cliente não é preguiça, é onde a permissão já existe.** Quem
 * escreve é `/api/sessions/written`, a mesma rota do editor, que confere dono
 * e passa pela RLS. A alternativa seria uma rota nova que escreve no acervo a
 * partir do que um modelo devolveu, o que é exatamente a rota que ninguém
 * quer ter.
 *
 * **As três últimas ferramentas não escrevem nada, só navegam** —
 * `iniciarGravacao`, `importarVideoDoYoutube`, `navegarPara`. São um
 * `router.push` cada, resolvido por `navigationTargetFor`
 * (`biblo-workspace.ts`) e disparado aqui dentro de `runActions`, no MESMO
 * laço que salva documento — uma ferramenta que estoura entra num `try`
 * próprio e vira um toast, sem derrubar a resposta (que já foi paga) nem as
 * ações seguintes da mesma mensagem.
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
 * O mesmo disco de vidro do Biblo das outras telas, no mesmo canto — e hoje,
 * SÓ NO DESKTOP: no celular a Biblioteca não tem mais um `+` e um disco do
 * Biblo dividindo o canto, ela tem a `MobileActionBar`, com as duas coisas
 * (e a busca) numa barra só. Ver "No celular o gatilho..." abaixo.
 *
 * **No celular o gatilho é a `MobileActionBar`, não mais este disco.** A
 * barra chama `ref.current.open()` (`BibloDockHandle`) e lê o `thinking` por
 * `onThinkingChange`; `hideMobileTrigger` esconde o disco só no celular
 * (`max-md:hidden`) — no desktop ele continua sendo o único caminho até a
 * gaveta, porque não há barra nenhuma lá. Ver o mesmo desenho em `BibloDock`.
 */
export const BibloHomeDock = forwardRef<
  BibloDockHandle,
  { hideMobileTrigger?: boolean; onThinkingChange?: (thinking: boolean) => void }
>(function BibloHomeDock({ hideMobileTrigger = false, onThinkingChange }, ref) {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [workspace, setWorkspace] = useState<BibloWorkspace>(EMPTY_WORKSPACE);
  const library = useLibraryWriter();
  const router = useRouter();
  useKeyboardInset();
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
  useEffect(() => {
    onThinkingChange?.(thinking);
  }, [thinking, onThinkingChange]);

  // Esconde-ao-rolar, hoje só relevante no DESKTOP (o disco só existe lá):
  // rolar para baixo é ler, rolar para cima é procurar, e perto do topo o
  // botão volta sempre, mesmo que o último gesto tenha sido para baixo.
  const [scrolledIn, setScrolledIn] = useState(true);
  const [moved, setMoved] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 8) return;
      lastY.current = y;
      const next = y < 80 ? true : dy < 0;
      setScrolledIn((prev) => {
        if (prev !== next) setMoved(true);
        return next;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      const before: BibloDoc | null = readWorkspace().doc;
      let doc: BibloDoc | null = before;
      let created = false;
      for (const action of actions) {
        onStep(ACTION_LABELS[action.tool]);
        try {
          // As três de navegação não salvam nada: é só um `router.push` para
          // a tela certa, com o parâmetro certo. Ver `navigationTargetFor`.
          const target = navigationTargetFor(action);
          if (target) {
            router.push(target);
            continue;
          }
          const outcome = await runBibloAction(action, doc);
          // `null` é a ação que não tinha para onde ir (renomear sem documento);
          // `ok: false` é o salvamento que falhou. Nos dois a conversa segue: a
          // resposta do Biblo já está paga, e derrubá-la por causa de um POST
          // seria cobrar duas vezes pela mesma pergunta.
          if (!outcome?.ok) continue;
          doc = outcome.doc;
          created = created || outcome.created;
        } catch (error) {
          // Uma ferramenta que estoura não pode levar a conversa junto: a
          // resposta já foi paga e já está na tela, só a AÇÃO falhou. O
          // toast avisa em vez de fingir que nada aconteceu — é o mesmo
          // texto amigável de qualquer outro pedaço do produto que erra.
          log.error("ação do Biblo falhou", { tool: action.tool, error: String(error) });
          toast.error("Não consegui fazer isso agora. Tente novamente em instantes.");
        }
      }
      setWorkspace((w) => {
        const next = { ...w, doc };
        writeWorkspace(next);
        return next;
      });
      // O acervo guardado no aparelho está bem atrás desta gaveta, e as duas
      // maneiras de ele ficar errado pedem remédios diferentes.
      //
      // **Nascer** exige a lista inteira de volta: o cartão novo não existe no
      // cache, e não há como inventá-lo aqui sem repetir a forma que o servidor
      // monta (a data agrupada, o modo, o trecho).
      //
      // **Mudar de TÍTULO** já existe, e um `invalidate` ali seria buscar o
      // acervo inteiro para corrigir uma string. A escrita otimista é o mesmo
      // caminho que renomear pelo `/summary` usa, e ela conserta o que estava
      // simplesmente errado antes: pedir "muda o título para X" com o documento
      // já criado deixava o cartão da Biblioteca com o nome antigo até alguém
      // recarregar a página.
      if (created) void library.invalidate();
      else if (doc && before && doc.title !== before.title) {
        library.patch(doc.id, { title: doc.title });
      }
    },
    [library, router]
  );

  const banner = workspace.doc ? (
    <div className="flex items-center gap-2 rounded-xl bg-scriba-hairline/40 px-3 py-2">
      <FileText aria-hidden className="size-3.5 shrink-0 text-scriba-ink-mute" strokeWidth={1.75} />
      <Link
        href={`/summary/${workspace.doc.id}/edit`}
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
          aceso, ele VIROU a gaveta. Só existe no DESKTOP hoje
          (`hideMobileTrigger`); no celular quem abre é a `MobileActionBar`.
          Ver "## O botão" no topo do arquivo. */}
      {!open && (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-5 pb-[calc(1.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))] md:pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]",
            hideMobileTrigger && "max-md:hidden"
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Conversar com o Biblo"
            aria-expanded={false}
            // Escondido ele também sai do alcance do dedo e do TAB, a mesma
            // regra do `+` do `CreateDock`.
            tabIndex={scrolledIn ? undefined : -1}
            aria-hidden={scrolledIn ? undefined : true}
            className={cn(
              "inline-flex size-14 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute",
              scrolledIn ? "pointer-events-auto" : "pointer-events-none",
              moved && (scrolledIn ? "animate-v2-rec-in" : "animate-v2-rec-out")
            )}
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
});
