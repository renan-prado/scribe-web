"use client";

import { useState } from "react";
import { BibloDrawer } from "@/features/session/components/BibloDrawer";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { BibloSuggestion } from "@/lib/domain/biblo";
import { BibloAvatar } from "@/shared/brand";

/**
 * O botão do Biblo: flutuante, no canto inferior direito, nas DUAS telas.
 *
 * ## Ele é o terceiro do mesmo gesto
 *
 * O `CreateDock` da Biblioteca (o `+`) e o `AdminMenu` do painel (o
 * hambúrguer) já são o mesmo botão com conteúdos diferentes — o cabeçalho do
 * segundo diz isso com todas as letras. Este herda a peça: disco de vidro de
 * 56px no canto, sem véu atrás, o glifo que NÃO gira para virar um "×".
 *
 * **O glifo é o rosto do Biblo**, e é o único dos três com cara em vez de
 * símbolo. É o que faz "conversar com o Scriba" virar "perguntar ao Biblo".
 *
 * ## Por que ele fica na leitura, e não no cabeçalho
 *
 * A pergunta nasce no meio do texto, no parágrafo doze — não no topo dele. Um
 * botão no cabeçalho obriga a rolar até em cima, perguntar, e achar o lugar de
 * volta. É também o único canto que o polegar alcança num celular grande, e,
 * no celular, é de onde a gaveta sobe: o botão VIRA a gaveta.
 *
 * ## Ele NÃO some ao rolar, ao contrário do `+` da Biblioteca
 *
 * Lá o botão se esconde na descida porque "rolar para baixo é LER e o botão
 * cobre o que se está lendo". Aqui o argumento se inverte: a dúvida aparece
 * DURANTE a descida, e um botão que foge exatamente nesse momento é o pior
 * instante possível para ele sumir. Quem resolve o "cobre o texto" é o
 * material — o disco é de vidro com `backdrop-blur`, e o texto continua
 * legível através dele. É a mesma razão de o `AdminMenu` poder ficar parado
 * sobre uma tabela.
 *
 * ## O teclado
 *
 * `--kb-inset` (ver `hooks/use-keyboard-inset.ts`) e `max()` com a faixa do
 * iPhone: com o teclado aberto ele a cobre, então somar os dois empurraria o
 * botão para o meio da tela.
 *
 * ## O que ele faz com a gaveta fechada
 *
 * **Continua pensando.** Quem fecha para reler o versículo enquanto a resposta
 * não chega vê o rosto no canto em `thinking`, e voltando a `idle` quando ela
 * chega: é o aviso de "terminei" sem badge, sem ponto vermelho e sem
 * notificação.
 */
export function BibloDock({
  sessionId,
  onInsert,
  onRemove,
}: {
  sessionId: string;
  /** Ausente na tela que não sabe editar: a conversa funciona, sem "Adicionar". */
  onInsert?: (suggestion: BibloSuggestion) => void;
  onRemove?: (suggestion: BibloSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  useKeyboardInset();

  return (
    <>
      {/* O botão sai da tela enquanto a gaveta está aberta: ele não é um
          interruptor aceso, ele VIROU a gaveta, e ela tem o próprio fechar. */}
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]">
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
          sessionId={sessionId}
          onClose={() => setOpen(false)}
          onThinking={setThinking}
          onInsert={onInsert}
          onRemove={onRemove}
        />
      )}
    </>
  );
}
