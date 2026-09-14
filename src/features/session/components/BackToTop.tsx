"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * O botão de voltar ao topo das telas de LEITURA (o `/summary` e o estudo).
 *
 * Ele existe porque essas duas são as únicas telas longas do produto: um
 * estudo passa de dez mil palavras, e o caminho de volta ao título — que é
 * também onde estão o voltar, o menu e a barra — era rolar tudo de novo.
 *
 * **Só aparece depois de uma tela e meia de rolagem.** Antes disso o topo está
 * à vista, e um botão flutuante ali seria um objeto a mais cobrindo o texto
 * para oferecer o que já está na tela. Some ao voltar, pela mesma razão.
 *
 * **Discreto de propósito**: um disco da cor do cartão, sem sombra e sem cor
 * de ação. Ele não é o que a tela veio oferecer — o que vale aqui é gerar o
 * estudo, e um botão vermelho no mesmo canto disputaria com aquilo.
 *
 * Fica ACIMA do inset do iPhone (`env(safe-area-inset-bottom)`), senão no
 * Safari ele nasce debaixo da barra do gesto do sistema.
 *
 * `scrollTo` com `behavior: "smooth"`, e o navegador de quem pediu menos
 * movimento resolve sozinho: `prefers-reduced-motion` já é respeitado pelo
 * scroll suave nativo, não há o que conferir aqui.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // `passive`: este ouvinte nunca cancela o gesto, e dizê-lo tira o scroll
    // do caminho crítico do toque.
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Voltar ao topo"
      // `aria-hidden` + `tabIndex={-1}` enquanto escondido: sem isso o botão
      // continua na ordem do teclado e no leitor de tela, anunciando uma ação
      // que ninguém vê. Ele sai da tela por opacidade (e não por `hidden`)
      // para poder ir e voltar com transição.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex size-10 items-center justify-center rounded-full bg-scriba-surface text-scriba-ink-soft ring-1 ring-scriba-hairline transition-all hover:text-scriba-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scriba-ink-mute ${
        visible ? "opacity-90" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp className="size-5" strokeWidth={1.75} />
    </button>
  );
}
