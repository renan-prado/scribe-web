"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { useLibraryWriter } from "@/features/session/query";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { BibloAction } from "@/lib/domain/biblo";
import { createLogger } from "@/lib/log";

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
 * ## Ela não tem mais um botão, ela tem um ENDEREÇO
 *
 * Esta gaveta era um `open` de estado, aberto por um `ref.current.open()` que
 * a `MobileActionBar` e um disco flutuante chamavam. Hoje ela é a rota
 * `/home/chat` (`home/@overlay/chat/`): quem abre é um `<Link>`, quem fecha é
 * o voltar do sistema, e o endereço colado numa nova aba reconstrói a mesma
 * tela. O disco do desktop virou o `BibloHomeTrigger`, um link, e some da
 * tela por ROTA em vez de por `{!open && …}`.
 *
 * **Ela só existe montada, e por isso não tem mais `open`.** Fechar é
 * desmontar, como já era ao tocar o "X" (`BibloDrawer` sempre desmontou em vez
 * de animar a saída). O que não se perde nisso: o documento em edição está no
 * `localStorage` (`readWorkspace`) e as mensagens estão no cache do TanStack,
 * que vive no `CacheOwner`, um degrau acima desta rota.
 *
 * O `thinking` também saiu: ele acendia o avatar do botão, e o botão não está
 * mais na mesma árvore que a conversa.
 */
export function BibloHomeDrawer({ onClose }: { onClose: () => void }) {
  const [workspace, setWorkspace] = useState<BibloWorkspace>(EMPTY_WORKSPACE);
  const library = useLibraryWriter();
  const router = useRouter();
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
    <BibloDrawer
      surface="home"
      sessionId={workspace.sessionId ?? ""}
      ensureSession={ensureSession}
      onActions={runActions}
      banner={banner}
      onClose={onClose}
    />
  );
}
