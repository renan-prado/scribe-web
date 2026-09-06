import { SILENCE_RMS_THRESHOLD } from "@/features/session/config";
import { createLogger } from "@/lib/log";

const log = createLogger("audio");

type OfflineCtor = typeof OfflineAudioContext;

/**
 * Contexto de decodificação, criado uma vez e reusado por toda a sessão.
 *
 * É `OfflineAudioContext` de propósito, e não `AudioContext`: só precisamos de
 * `decodeAudioData`, e um contexto OFFLINE renderiza para um buffer em memória
 * — ele não abre unidade de áudio, não ativa a `AVAudioSession` no iOS e não
 * conta para o limite de contextos de hardware do Chrome. A versão anterior
 * abria um `new AudioContext()` A CADA CHUNK e o fechava sem esperar
 * (`void ctx.close()`); no último chunk isso acontecia no MEIO do teardown da
 * gravação — abrindo uma sessão de áudio nativa no exato instante em que o
 * recorder para as tracks e a shell React Native desativa a dela. Reusar um
 * contexto offline elimina as duas coisas.
 */
let decodeCtx: OfflineAudioContext | null = null;

function getDecodeContext(): OfflineAudioContext | null {
  if (decodeCtx) return decodeCtx;
  if (typeof window === "undefined") return null;
  const OAC =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;
  if (!OAC) return null;
  try {
    // As dimensões são irrelevantes — nada é renderizado, o contexto existe só
    // para hospedar `decodeAudioData`, que devolve o buffer na taxa do arquivo.
    decodeCtx = new OAC(1, 1, 44_100);
  } catch (err) {
    log.warn("offline context unavailable", { error: String(err) });
    return null;
  }
  return decodeCtx;
}

/**
 * Decode the recorded blob and compute its RMS. Anything below the silence
 * threshold is treated as silence — we mark those chunks and skip transcription.
 * Runs client-side; failures fall through to "not silent" so we err on the side
 * of transcribing.
 */
export async function isSilentBlob(blob: Blob): Promise<boolean> {
  const ctx = getDecodeContext();
  if (!ctx) return false;
  try {
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    let sumSquares = 0;
    let count = 0;
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        sumSquares += data[i] * data[i];
        count++;
      }
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, count));
    return rms < SILENCE_RMS_THRESHOLD;
  } catch (err) {
    // Não sabemos se o blob é ruim ou se o decoder recusou o codec — nos dois
    // casos transcrever é o lado seguro do erro. Fica o registro para o caso de
    // isso passar a acontecer em TODO chunk (aí estaríamos pagando transcrição
    // de silêncio, e o log é o único sinal).
    log.debug("decode failed, treating as speech", { size: blob.size, error: String(err) });
    return false;
  }
}
