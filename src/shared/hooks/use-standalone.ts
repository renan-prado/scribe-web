"use client";

import { useEffect, useState } from "react";

/**
 * O app está rodando COMO app — instalado na tela inicial, sem a moldura do
 * navegador?
 *
 * Não existe uma API só para isso, então a resposta é a união de duas:
 *
 * - `display-mode: standalone` é a media query padrão, e vale no Android e no
 *   desktop. `fullscreen` e `minimal-ui` entram junto porque são os outros
 *   modos que o nosso `display_override` pode acabar resolvendo — em qualquer
 *   um deles o usuário está no app, não numa aba.
 * - `navigator.standalone` é a propriedade proprietária da Apple, e continua
 *   sendo a ÚNICA forma de saber isso no iOS.
 *
 * Não confunda com "instalado": alguém pode ter o Scriba na tela inicial e
 * estar lendo esta página numa aba comum. O que se mede aqui é a JANELA atual.
 */
export function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Versão React do `readStandalone`.
 *
 * `ready` é falso no servidor e no primeiro render do cliente — não há como
 * saber a resposta antes de haver um `window`. **Quem desenha coisas
 * diferentes para os dois casos precisa esperar por ele**, senão o HTML do
 * servidor discorda do primeiro render e o React descarta a árvore (ou, pior,
 * o usuário vê o estado errado piscar).
 *
 * `isStandalone` começa em `false` porque é o caso da esmagadora maioria das
 * visitas; quem quiser o palpite oposto (não oferecer instalação para quem já
 * instalou) usa o `ready` para adiar a decisão.
 */
export function useIsStandalone(): { isStandalone: boolean; ready: boolean } {
  const [isStandalone, setIsStandalone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsStandalone(readStandalone());
    setReady(true);

    // A janela PODE trocar de modo em vida: o Chrome no desktop instala o app
    // e move a aba para a janela do PWA sem recarregar nada.
    const query = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setIsStandalone(readStandalone());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return { isStandalone, ready };
}
