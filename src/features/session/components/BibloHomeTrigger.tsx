"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BIBLO_TRIGGER_CLASS } from "@/features/session/components/BibloDock";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";

/**
 * O disco do Biblo no canto da Biblioteca, e SÓ NO DESKTOP.
 *
 * ## Ele é um link, não um botão
 *
 * Era um `<button>` que chamava `setOpen(true)` na mesma árvore da gaveta. Hoje
 * a gaveta é a rota `/home/chat`, e um link é o que abre uma rota: ele ganha o
 * menu de contexto do navegador, o Ctrl+clique, o prefetch, e o aplicativo que
 * um dia desenhar este menu em nativo não precisa de mais nada além do
 * endereço para fazer o mesmo. Ver `lib/overlay-routes.ts`.
 *
 * **Ele não some mais com um `{!open && …}`, ele some com a ROTA.** Quem o
 * desenha é `home/@overlay/page.tsx`, o estado do slot em `/home`; em
 * `/home/chat` o slot passa a ser a gaveta, e o disco sai de cena sozinho.
 * Pelo mesmo caminho ele também sai em `/home/search` — uma gaveta de cada
 * vez, que é o que sempre se quis e antes dependia de os dois componentes
 * saberem um do outro.
 *
 * ## No celular quem abre é a `MobileActionBar`
 *
 * `max-md:hidden` e nada mais: lá a Biblioteca tem a barra do rodapé, com
 * busca, Biblo e criar numa fileira só, e um disco flutuante seria o quarto
 * botão da mesma tela para a mesma coisa. No desktop não há barra, e este é o
 * único caminho até a conversa.
 *
 * ## Esconde-ao-rolar
 *
 * Rolar para baixo é ler, rolar para cima é procurar, e perto do topo o botão
 * volta sempre, mesmo que o último gesto tenha sido para baixo. Escondido ele
 * também sai do alcance do TAB, a mesma regra do "+" que o `CreateDock` tinha.
 */
export function BibloHomeTrigger({ href }: { href: string }) {
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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-5 pb-[calc(1.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))] max-md:hidden md:pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]">
      <Link
        href={href}
        aria-label="Conversar com o Biblo"
        tabIndex={scrolledIn ? undefined : -1}
        aria-hidden={scrolledIn ? undefined : true}
        className={cn(
          BIBLO_TRIGGER_CLASS,
          scrolledIn ? "pointer-events-auto" : "pointer-events-none",
          moved && (scrolledIn ? "animate-v2-rec-in" : "animate-v2-rec-out")
        )}
      >
        <BibloAvatar mood="idle" size={36} />
      </Link>
    </div>
  );
}
