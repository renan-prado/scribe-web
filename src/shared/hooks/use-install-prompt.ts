"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsStandalone } from "@/shared/hooks/use-standalone";

/**
 * O evento que o Chrome/Edge disparam quando o site cumpre os requisitos de
 * instalação. Ele NÃO está no lib.dom do TypeScript porque não é padrão — é
 * uma extensão do Chromium — daí o tipo escrito à mão.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Como a instalação pode ser oferecida NESTE navegador. */
export type InstallMethod =
  /** Chromium: temos o evento na mão e um clique abre o diálogo nativo. */
  | "prompt"
  /** iOS: não existe API. Só dá para ENSINAR o caminho do menu Compartilhar. */
  | "ios"
  /** Já instalado, ou navegador que não instala nada — não ofereça. */
  | "none";

function readIsIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se anuncia como Macintosh; o que o denuncia é ter toque.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Estado da instalação do PWA. Quem só quer saber se a janela atual é o app
 * instalado usa `useIsStandalone` direto — este hook é para quem OFERECE a
 * instalação.
 *
 * `beforeinstallprompt` chega quando quer — normalmente alguns segundos após o
 * load —, então o componente que consome isto precisa aguentar `method` mudar
 * de "none" para "prompt" no meio da vida da página.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const { isStandalone, ready: standaloneReady } = useIsStandalone();
  // Falso no servidor e no primeiro render do cliente. Quem desenha um estado
  // ("instalado" / "instalar") em vez de só aparecer precisa esperar por ele.
  const [installedNow, setInstalledNow] = useState(false);

  useEffect(() => {
    setIsIos(readIsIos());

    const onBeforeInstall = (event: Event) => {
      // Sem o preventDefault o Chrome mostra a própria barrinha e o evento se
      // perde — é ele que nos dá o direito de chamar `prompt()` depois.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    // O usuário pode instalar pelo menu do navegador, sem passar pelo nosso
    // botão. A janela continua sendo uma aba (o `display-mode` não muda no
    // celular), mas o convite já não faz sentido.
    const onInstalled = () => {
      setDeferred(null);
      setInstalledNow(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Abre o diálogo nativo. Devolve `true` se o usuário aceitou.
   *
   * O evento é de uso ÚNICO: recusado, o Chrome só manda outro depois de um
   * tempo. Por isso ele é descartado nos dois desfechos — insistir com o mesmo
   * objeto não faz nada.
   */
  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    setDeferred(null);
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    return outcome === "accepted";
  }, [deferred]);

  const installed = isStandalone || installedNow;
  const method: InstallMethod = installed ? "none" : deferred ? "prompt" : isIos ? "ios" : "none";

  return { method, installed, ready: standaloneReady, promptInstall };
}
