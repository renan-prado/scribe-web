import { postNativeEvent } from "@/features/session/lib/nativeBridge";
import type { RecorderErrorEvent } from "@/lib/domain/recorder";
import { createLogger } from "@/lib/log";

const log = createLogger("recorder");

/**
 * Handler único de `recorder.onError` para os três modos de captura.
 *
 * Ele existe porque durante muito tempo NINGUÉM registrava `onError`: o
 * recorder emitia falha de encoder, de construtor de MediaRecorder e de setup
 * de VAD para um callback nulo, e o web seguia como se estivesse gravando. Um
 * MediaRecorder que morre no meio de uma pregação é indistinguível, na tela, de
 * um trecho em silêncio — o timer continua correndo e nenhum chunk chega.
 *
 * O erro não derruba a gravação de propósito: `chunk` e `vad` são recuperáveis
 * (o hard-cut timer refaz o recorder no corte seguinte) e abortar uma sessão
 * por causa de um chunk perdido é pior que perder o chunk. O que fazemos é
 * deixar rastro nos dois lados — logger do web e ponte para a shell nativa,
 * que é o único caminho até um crash report em produção.
 */
export function reportRecorderError(sessionId: string, ev: RecorderErrorEvent): void {
  log.error("recorder falhou", { sessionId, source: ev.source, message: ev.message });
  postNativeEvent({
    type: "recorder:error",
    sessionId,
    source: ev.source,
    message: ev.message,
  });
}
