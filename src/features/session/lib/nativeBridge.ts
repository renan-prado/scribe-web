/**
 * Thin bridge for when this web app is embedded inside a React Native WebView.
 * The RN shell subscribes to `onMessage` on the WebView and reacts to these
 * payloads — typically by starting/stopping a native foreground service
 * (Android: `foregroundServiceType="microphone"`) or activating an
 * `AVAudioSession` background category (iOS). Without a native side those
 * messages are simply no-ops.
 *
 * When rendered in a normal browser tab `window.ReactNativeWebView` is
 * undefined and every helper here becomes a no-op.
 */
type ReactNativeWebViewHandle = { postMessage: (data: string) => void };

declare global {
  interface Window {
    ReactNativeWebView?: ReactNativeWebViewHandle;
  }
}

/**
 * O ciclo de vida que a shell nativa observa.
 *
 * `pause` e `resume` existem separados de `stop`/`start` porque a shell reage a
 * `stop` DESTRUINDO recursos — no Android, parando o foreground service; no
 * iOS, desativando a `AVAudioSession`. Enquanto os dois pares eram um só, uma
 * gravação com três pausas mandava a shell destruir e recriar tudo três vezes
 * antes do fim. Dois estragos vinham daí:
 *
 * 1. Multiplicava por N as chances de um teardown nativo com bug (foi assim que
 *    um `throw` de biblioteca no stop do foreground service derrubava o app na
 *    PRIMEIRA pausa, não no fim da gravação).
 * 2. O congelamento por saldo zerado (`useCoinGuard.onFreeze`) pausa SOZINHO,
 *    sem gesto do usuário e possivelmente com o app em segundo plano — soltar o
 *    foreground service ali é convidar o Android a matar o processo justamente
 *    quando a sessão está viva esperando crédito.
 *
 * Numa pausa a captura para, mas a SESSÃO continua: transcrição, fila de chunks
 * e feed seguem vivos. A shell deve manter o serviço e a sessão de áudio de pé
 * e só trocar o texto da notificação. Quem ainda não conhecer os dois eventos
 * novos os ignora, e o efeito é o serviço seguir rodando durante a pausa —
 * degradação correta, e melhor que o ciclo destrói/recria.
 */
export type NativeRecordingEvent =
  | { type: "recording:start"; sessionId: string; label?: string }
  | { type: "recording:pause"; sessionId: string }
  | { type: "recording:resume"; sessionId: string }
  | { type: "recording:stop"; sessionId: string }
  | { type: "recording:heartbeat"; sessionId: string; elapsedMs: number }
  /**
   * Falha do MediaRecorder / do VAD / do getUserMedia. Sobe para o nativo
   * porque o console da WebView não é visível em produção, e a shell é o único
   * lugar de onde esse rastro alcança um crash report. Não é fatal por si só —
   * o web decide o que fazer; para o nativo isto é diagnóstico.
   */
  | { type: "recorder:error"; sessionId: string; source: string; message: string }
  /**
   * Pedido de haptic curto (card novo no feed). Existe porque iOS/Safari não
   * implementa `navigator.vibrate` — dentro da shell RN quem vibra é o nativo.
   */
  | { type: "haptics:tap" };

export function isReactNativeWebView(): boolean {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

export function postNativeEvent(event: NativeRecordingEvent): void {
  if (typeof window === "undefined") return;
  const handle = window.ReactNativeWebView;
  if (!handle) return;
  try {
    handle.postMessage(JSON.stringify(event));
  } catch {
    // swallow — RN bridge may not be ready during teardown
  }
}
