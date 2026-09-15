"use client";

import { useEffect } from "react";

/**
 * A metade da trava de zoom que a `<meta viewport>` não consegue fazer.
 *
 * O `APP_VIEWPORT` (ver `src/shared/viewport.ts`) já diz `user-scalable=no`, e
 * isso basta no Chrome do Android, no app instalado do iOS e dentro de um
 * WKWebView. **Sobra a aba comum do Safari do iPhone, que ignora a meta desde
 * o iOS 10** e continua ampliando na pinça. O jeito de falar com ela é
 * cancelar os eventos `gesture*` do WebKit, que são proprietários e não têm
 * equivalente padrão.
 *
 * O `touch-action` no `<html>` é o irmão disso no Android e nos navegadores
 * modernos: `pan-x pan-y` libera rolar e proíbe ampliar, na pinça E no toque
 * duplo. `manipulation` NÃO serve aqui, ele só desliga o toque duplo e deixa a
 * pinça passar.
 *
 * Fica num componente montado pelo layout, e não em `globals.css`, porque a
 * trava vale para o APP e não para o site: o CSS global pegaria a landing
 * junto, e lá o zoom é para continuar existindo.
 *
 * Os listeners são `passive: false` — sem isso o navegador ignora o
 * `preventDefault()` e a trava não faz nada, silenciosamente.
 */
export function ZoomLock(): null {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.touchAction;
    root.style.touchAction = "pan-x pan-y";

    const block = (event: Event) => event.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"] as const;
    for (const name of events) {
      document.addEventListener(name, block, { passive: false });
    }

    return () => {
      root.style.touchAction = previous;
      for (const name of events) {
        document.removeEventListener(name, block);
      }
    };
  }, []);

  return null;
}
