"use client";

import { useState } from "react";
import { BookGlyph } from "@/components/icons/BookGlyph";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BibleReader } from "@/features/session/components/BibleReader";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * A Bíblia à mão na tela de LEITURA, sem sair dela.
 *
 * ## O problema
 *
 * Lendo um resumo, a pessoa quer conferir uma passagem que o texto NÃO citou
 * como bloco, ou ler o capítulo inteiro em volta de um versículo que ele
 * citou. As duas coisas existiam pela metade: `ChapterMention` abre o capítulo
 * de uma referência ESCRITA no texto, e o `PassagePicker` do editor obriga a
 * inserir um bloco no documento para poder ver a passagem. Ler sem escrever
 * nada era sair do app.
 *
 * ## Por que ele é um botão LATERAL, e não mais um no canto de baixo
 *
 * Porque aquele canto já tem dois donos e uma regra: o Biblo mora nele
 * (permanente, embaixo) e o "voltar ao topo" empilha por cima quando aparece
 * (ver `BackToTop`). Um terceiro disco ali faria uma torre de três botões
 * sobre o texto, e o de baixo — o principal — continuaria pulando de lugar.
 *
 * A borda direita, na altura do olho, é um lugar vazio em toda a tela de
 * leitura, e uma aba colada nela é a forma que o próprio gesto sugere: puxar a
 * Bíblia de fora da página. Ela é estreita (36px) e de VIDRO, pela mesma razão
 * do disco do Biblo — o texto continua legível através dela, e é isso que
 * permite que ela nunca suma.
 *
 * ## O painel abre do lado em que há espaço
 *
 * No desktop, gaveta pela direita: sobra largura, e a leitura continua à
 * vista, que é o ponto de consultar a Bíblia enquanto se lê. No celular ela
 * sobe do rodapé, ocupando 85% da altura, porque não há largura para dividir —
 * é o mesmo desenho da gaveta do Biblo, e por isso não é uma terceira
 * gramática de painel.
 *
 * ## `keepMounted`, e ele não é otimização
 *
 * **Nada da tela de leitura pode se perder ao abrir e fechar a Bíblia**: nem a
 * rolagem (o painel é um portal, a página não desmonta nem rola por baixo), nem
 * os realces da busca do resumo (`SummaryFind` pinta `Range`s sobre o DOM já
 * existente, e ele continua existindo). Falta o terceiro: a Bíblia ABERTA em
 * Romanos 8 não pode voltar à lista dos 66 livros só porque alguém fechou o
 * painel para conferir um parágrafo. Com o conteúdo mantido no DOM, reabrir
 * devolve a pessoa exatamente onde ela estava.
 */
export function BibleDock() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <button
        type="button"
        data-slot="bible-dock"
        onClick={() => setOpen(true)}
        aria-label="Abrir a Bíblia"
        aria-expanded={open}
        title="Bíblia"
        className="fixed top-1/2 right-0 z-30 inline-flex h-14 w-9 -translate-y-1/2 items-center justify-center rounded-l-2xl bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink-soft ring-1 ring-v2-glass-edge backdrop-blur-xl transition-[opacity,filter,color] hover:text-v2-ink hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
      >
        <BookGlyph className="size-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          keepMounted
          side={isMobile ? "bottom" : "right"}
          className="h-[85dvh] gap-0 p-0 data-[side=right]:h-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="shrink-0 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <BookGlyph className="size-3.5" />
              Bíblia
            </SheetTitle>
          </SheetHeader>
          <BibleReader className="min-h-0 flex-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" />
        </SheetContent>
      </Sheet>
    </>
  );
}
