"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * A gravação vista de FORA da aba: a notificação do sistema, os controles da
 * tela de bloqueio e o que impede o navegador de dormir no meio da pregação.
 *
 * ## O defeito que ela conserta
 *
 * Quem apoia o celular no banco e volta para o WhatsApp não tem, em lugar
 * nenhum do aparelho, uma frase dizendo que o Scriba continua gravando. A
 * gravação segue (o `MediaRecorder` não para ao esconder a aba), mas nada na
 * tela do sistema confirma isso, e a única maneira de conferir é voltar ao app
 * — que é exatamente o gesto que a pessoa não quer dar no meio do sermão. A
 * insegurança resultante faz gente desistir de minimizar, ou pior, reabrir o
 * app a cada minuto para ver se ainda está lá.
 *
 * ## Três camadas, e cada uma responde uma pergunta diferente
 *
 * **1. O áudio silencioso é o que mantém a aba ACORDADA.** Um navegador em
 * segundo plano corta temporizadores, para o `requestAnimationFrame` e, no
 * celular, pode congelar a aba inteira. Uma aba que está TOCANDO áudio não é
 * congelada — é a mesma regra que mantém um podcast vivo com a tela apagada —,
 * e é por isso que a faixa muda não vale o nome de gambiarra: ela é a única
 * declaração que o navegador aceita de "esta aba está fazendo algo que não pode
 * ser interrompido". O `media-src 'self' blob:` da CSP existe por causa dela.
 *
 * **2. A Media Session é a notificação de MÍDIA**, a que aparece com o ícone do
 * app e os controles na tela de bloqueio. Ela vem de graça a partir da camada
 * 1: com áudio tocando, basta declarar o metadado. Os botões de pausar, tocar e
 * parar chegam ao MESMO gravador que os botões da tela, então pausar pela tela
 * de bloqueio pausa a gravação de verdade.
 *
 * **3. A notificação do sistema é a FRASE**, e ela só aparece quando a aba
 * esconde. "Gravando áudio em background…" numa aba que está na frente seria
 * dizer o óbvio duas vezes, e um aviso que aparece quando não precisa é o
 * primeiro passo para ser ignorado quando precisa. Ela é fixa
 * (`requireInteraction`), silenciosa (o sermão está acontecendo) e some sozinha
 * quando a pessoa volta.
 *
 * ## Por que a permissão é pedida no START
 *
 * Porque é o único momento do fluxo que é um GESTO da pessoa e que tem um
 * porquê visível: ela acabou de mandar gravar uma hora de pregação. Pedir na
 * abertura do app seria pedir antes de existir o que notificar, e pedir na hora
 * de esconder a aba é pedir quando ninguém está olhando para a tela.
 *
 * **Nada aqui é obrigatório.** Permissão negada, navegador sem Media Session,
 * aba anônima que recusa o `play()`: cada camada falha sozinha e em silêncio, e
 * a gravação continua exatamente como continuava antes de este arquivo existir.
 */

const NOTIFICATION_TAG = "scriba-recording";
const NOTIFICATION_TITLE = "Gravando áudio em background…";
const NOTIFICATION_BODY = "O Scriba continua gravando. Toque para voltar.";
/** O ícone do aplicativo, o mesmo do manifest. */
const APP_ICON = "/brand/icon-192.png";
/** O glifo do microfone, que é o que diz do que se trata sem ler o texto. */
const MIC_BADGE = "/icons/microfone.svg";

type Options = {
  /** Há microfone aberto (gravando OU pausado). */
  active: boolean;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

/**
 * Um WAV silencioso de 10 segundos, montado em memória.
 *
 * Arquivo no `public/` seria um pedido de rede para reproduzir silêncio, e
 * numa igreja com sinal ruim esse pedido pode não voltar — justamente no
 * aparelho em que a aba mais precisa ficar acordada. 8 kHz, 8 bits, mono: 80 KB
 * de RAM. A faixa é longa de propósito, um loop de meio segundo é reiniciado
 * tantas vezes por minuto que alguns navegadores deixam de contá-lo como
 * reprodução contínua.
 */
function silentWavUrl(): string {
  const sampleRate = 8000;
  const frames = sampleRate * 10;
  const buffer = new ArrayBuffer(44 + frames);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + frames, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // bytes por segundo
  view.setUint16(32, 1, true); // alinhamento de bloco
  view.setUint16(34, 8, true); // bits por amostra
  ascii(36, "data");
  view.setUint32(40, frames, true);
  // Em PCM de 8 bits o silêncio é 128, e não 0: o buffer nasce zerado, que
  // seria a amplitude mínima tocada como um estouro.
  new Uint8Array(buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/**
 * Pede a permissão de notificar, se ela ainda não foi decidida.
 *
 * Mora fora do hook porque quem a chama é o TOQUE em "gravar": um pedido de
 * permissão disparado por um efeito é um pedido sem gesto atrás, e é assim que
 * um navegador decide bloquear o site inteiro para sempre.
 */
export async function askRecordingNotificationPermission(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Navegador que só aceita a forma antiga com callback, ou que recusa o
    // pedido. Sem notificação, as outras duas camadas continuam de pé.
  }
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export function useRecordingPresence({ active, paused, onPause, onResume, onStop }: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  /** A notificação criada SEM service worker. Só ela precisa ser guardada:
   *  a do service worker é reencontrada pela `tag`. */
  const looseRef = useRef<Notification | null>(null);

  const handlers = useRef({ onPause, onResume, onStop });
  handlers.current = { onPause, onResume, onStop };

  const closeNotification = useCallback(async () => {
    looseRef.current?.close();
    looseRef.current = null;
    const reg = await swRegistration();
    if (!reg) return;
    try {
      for (const n of await reg.getNotifications({ tag: NOTIFICATION_TAG })) n.close();
    } catch {
      // best-effort
    }
  }, []);

  const showNotification = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const options: NotificationOptions = {
      body: NOTIFICATION_BODY,
      icon: APP_ICON,
      badge: MIC_BADGE,
      tag: NOTIFICATION_TAG,
      silent: true,
      requireInteraction: true,
      data: { url: "/recording" },
    };
    const reg = await swRegistration();
    if (reg) {
      // O toque nela é tratado pelo `notificationclick` do `public/sw.js`, que
      // é quem sabe trazer a aba de volta para a frente.
      await reg.showNotification(NOTIFICATION_TITLE, options).catch(() => {});
      return;
    }
    // Sem service worker (o `npm run dev` não o registra, ver `PwaBootstrap`).
    // O Android recusa este construtor com um TypeError, e aí não há aviso —
    // mas lá o service worker existe, então o caminho de cima é o que roda.
    try {
      const loose = new Notification(NOTIFICATION_TITLE, options);
      loose.onclick = () => {
        window.focus();
        loose.close();
      };
      looseRef.current = loose;
    } catch {
      // sem notificação neste navegador
    }
  }, []);

  // Camada 1: a aba acordada. O elemento nasce e morre com a gravação, e não
  // com a tela: montá-lo no primeiro render deixaria um `<audio>` pendurado em
  // quem só passou pelo gravador sem gravar.
  useEffect(() => {
    if (!active) return;
    const url = silentWavUrl();
    urlRef.current = url;
    const audio = new Audio(url);
    audio.loop = true;
    // Não é para ser ouvido, é para existir. Volume zero faria alguns
    // navegadores tratarem a aba como silenciosa e congelá-la assim mesmo, que
    // é justamente o que a faixa existe para evitar.
    audio.volume = 0.001;
    audioRef.current = audio;
    void audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      URL.revokeObjectURL(url);
      urlRef.current = null;
    };
  }, [active]);

  // Camada 2: a notificação de mídia e os controles da tela de bloqueio.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (!active) {
      session.metadata = null;
      session.playbackState = "none";
      for (const action of ["play", "pause", "stop"] as const) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ação não suportada neste navegador
        }
      }
      return;
    }

    session.metadata = new MediaMetadata({
      title: NOTIFICATION_TITLE,
      artist: "Scriba",
      artwork: [
        { src: APP_ICON, sizes: "192x192", type: "image/png" },
        { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    session.playbackState = paused ? "paused" : "playing";

    const bind = (action: MediaSessionAction, handler: () => void) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // ação não suportada neste navegador
      }
    };
    bind("play", () => handlers.current.onResume());
    bind("pause", () => handlers.current.onPause());
    bind("stop", () => handlers.current.onStop());
  }, [active, paused]);

  // Camada 3: a frase, e só enquanto a aba está escondida.
  useEffect(() => {
    if (!active) {
      void closeNotification();
      return;
    }
    const sync = () => {
      if (document.visibilityState === "hidden") void showNotification();
      else void closeNotification();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      void closeNotification();
    };
  }, [active, closeNotification, showNotification]);
}
