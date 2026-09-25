"use client";

/**
 * A notificação "Gravando áudio em background…", vista de FORA da tela de
 * gravação.
 *
 * ## Por que ela precisava sair de dentro do hook
 *
 * Ela era criada e apagada por `useRecordingPresence`, e só por ele. Isso
 * funciona enquanto a aba está viva: o efeito monta, mostra, e o cleanup
 * apaga. O problema é que o cenário que a notificação existe para cobrir é
 * justamente aquele em que o cleanup NUNCA RODA — o sistema mata a aba com o
 * app minimizado, que é o que o Android faz com uma WebView em segundo plano
 * numa hora de pregação.
 *
 * O resultado era uma notificação FIXA (`requireInteraction`) pendurada na
 * gaveta do sistema, anunciando uma gravação que não existe mais, até alguém
 * tocá-la. Quem toca cai na tela de gravação, que estava vazia, e começa uma
 * gravação NOVA por cima da que ficou para trás. Foi exatamente esse o caminho
 * de um relato: o app não abriu na Biblioteca, abriu no gravador, e o botão do
 * meio deu erro.
 *
 * É a mesma mentira que `PAUSED_TITLE` existe para não contar, só que pior:
 * aquela dura o tempo de uma pausa, esta dura até a pessoa tocar nela.
 *
 * ## O conserto tem três pontas, e esta é a do app
 *
 * 1. **`public/sw.js`, no `activate`**: o service worker apaga a tag toda vez
 *    que assume. É a única ponta que funciona sem o app estar aberto.
 * 2. **Aqui, na abertura do app** (`PendingCaptureRunner`): quando o app monta
 *    não há gravação viva nesta aba por definição, então qualquer notificação
 *    com esta tag é sobra. Se uma gravação começar em seguida,
 *    `useRecordingPresence` a recria.
 * 3. **`public/sw.js`, no `notificationclick`**: sem janela aberta não há
 *    `MediaRecorder` vivo em lugar nenhum, então o toque leva para `/home`,
 *    onde a gravação que ficou para trás está esperando como cartão.
 *
 * A tag mora aqui e é repetida no `sw.js` por necessidade: um service worker
 * não importa módulo do bundle. Mexeu numa, mexa na outra.
 */

/** Mexeu aqui? Mexa em `NOTIFICATION_TAG` de `public/sw.js`. */
export const RECORDING_NOTIFICATION_TAG = "scriba-recording";

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Apaga a notificação de gravação, venha ela do service worker ou do
 * construtor solto.
 *
 * `loose` é a notificação criada sem service worker (o `npm run dev` não o
 * registra): ela não é reencontrável pela tag, então quem a criou precisa
 * entregá-la de volta. Do service worker, a tag basta.
 *
 * Tudo aqui é best-effort por desenho: sem permissão, sem service worker ou
 * com o navegador recusando, não há o que apagar e não há o que avisar.
 */
export async function closeRecordingNotification(loose?: Notification | null): Promise<void> {
  loose?.close();
  const reg = await swRegistration();
  if (!reg) return;
  try {
    for (const n of await reg.getNotifications({ tag: RECORDING_NOTIFICATION_TAG })) n.close();
  } catch {
    // best-effort
  }
}
