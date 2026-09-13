"use client";

import { useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

/**
 * A barra de baixo do v2: uma faixa que escurece até o preto, com o botão de
 * gravar centralizado nela.
 *
 * **Ela não tem fundo chapado, e é aí que está o desenho.** O que separa a
 * barra do conteúdo é um GRADIENTE (`--v2-dock-fade`), preto embaixo e
 * transparente em cima, então a lista não é cortada por uma borda, ela mergulha
 * na faixa. Isso também resolve o que a sombra do botão resolvia antes, e
 * melhor: a sombra separava o botão do que estava atrás DELE, num ponto só; a
 * faixa separa a barra inteira. Por isso o botão hoje não tem `shadow`.

 *
 * **O botão leva para o `/v2/recording` JÁ GRAVANDO**, pelo `?auto=1` da URL.
 * O parâmetro existe porque as duas portas da mesma tela querem coisas
 * diferentes: quem tocou o botão já disse que quer gravar, e pedir um segundo
 * toque do outro lado seria cobrar duas vezes pela mesma decisão; quem digita
 * `/v2/recording` na barra de endereço (ou volta a ela pelo histórico) não
 * pediu nada, e abrir o microfone sozinho ali seria uma tela que grava sem ser
 * chamada.
 *
 * É um `NavLink`, e não um `button` com `router.push`: o destino é uma ROTA, e
 * como link ele ganha de graça o que um botão não tem, abrir em nova aba,
 * copiar endereço, o prefetch do router e o foco do teclado se comportando
 * como o resto da navegação.
 *
 * **O BOTÃO some ao rolar para baixo e volta ao rolar para cima. A FAIXA fica.**
 * Rolar para baixo é ler, e o botão é o que cobre o que se está lendo; rolar
 * para cima é procurar, e quem procura na biblioteca costuma estar a um toque
 * de gravar. O gesto é o mesmo que esconde a barra de endereço do navegador no
 * celular, então a tela responde junto.
 *
 * O gradiente NÃO acompanha, e isso é escolha: ele não é enfeite do botão, é a
 * borda de baixo da tela, o que faz a lista terminar em desvanecimento em vez
 * de em corte. Piscando junto, a tela ganharia uma moldura que aparece e some
 * sozinha, que é justamente o tipo de movimento que cansa numa lista longa.
 *
 * As duas animações do botão são assimétricas (ver `app/globals.css`): sair é
 * opacidade e rápido, voltar é mais demorado e tem zoom.
 *
 * Três detalhes que não são estética:
 *
 * - **Perto do topo ela reaparece sempre**, mesmo que o último gesto tenha
 *   sido para baixo. Sem isso, uma lista curta demais para rolar de volta
 *   deixaria o botão escondido sem nenhum jeito óbvio de trazê-lo.
 * - **Um piso de 8px por gesto.** Sem ele o repique do iOS no fim da rolagem
 *   (e o tremor do dedo parado) alterna as duas animações sozinho.
 * - **O `scroll` é `passive`.** Um listener que pode chamar `preventDefault`
 *   obriga o navegador a esperar por ele antes de pintar cada quadro da
 *   rolagem, e é exatamente isso que o dedo sente.
 */
export function RecordDock() {
  const [visible, setVisible] = useState(true);
  // Enquanto ninguém rolou não há animação nenhuma: no carregamento da página
  // ela seria um movimento sem causa.
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
      setVisible((prev) => {
        if (prev !== next) setMoved(true);
        return next;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    /* `pointer-events-none` na faixa inteira: ela cobre o fim da lista, e um
       gradiente que engole o toque destinado ao último cartão seria um bug
       invisível. Só o botão recebe de volta o que ela abre mão. */
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-[image:var(--v2-dock-fade)] pt-32 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <NavLink
        href="/v2/recording?auto=1"
        aria-label="Gravar"
        // Sem spinner: o destino não busca nada no servidor, e um spinner
        // dentro de um disco de 56px é mais movimento do que informação.
        spinner="none"
        contentClassName="inline-flex items-center justify-center"
        // Escondido ele também sai do alcance do dedo e do TAB: um botão
        // invisível que ainda recebe toque é pior que um botão visível.
        tabIndex={visible ? undefined : -1}
        aria-hidden={visible ? undefined : true}
        className={cn(
          "inline-flex size-14 items-center justify-center rounded-full bg-v2-rec text-v2-rec-ink transition-colors hover:bg-v2-rec-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-rec",
          visible ? "pointer-events-auto" : "pointer-events-none",
          moved && (visible ? "animate-v2-rec-in" : "animate-v2-rec-out")
        )}
      >
        <MicGlyph className="size-7" />
      </NavLink>
    </div>
  );
}
