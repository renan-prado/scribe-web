import { createLogger } from "@/lib/log";

const log = createLogger("mic");

/**
 * O que pedimos ao microfone, e as três coisas que pedimos para ele NÃO fazer.
 *
 * Era `{ audio: true }`, e `true` não é neutro: o Chrome liga por padrão
 * `echoCancellation`, `noiseSuppression` e `autoGainControl` — o pacote do
 * WebRTC afinado para CHAMADA DE VOZ, uma boca a vinte centímetros do aparelho,
 * num quarto, e tudo o mais é inimigo. Um salão de igreja é o caso oposto: a voz
 * chega refletida, de longe, e o "ruído" que a supressão ataca é a mesma cauda
 * reverberante que carrega a fala.
 *
 * Medido: rodar um denoiser espectral (`afftdn`) sobre o áudio de referência
 * antes de transcrever levou o WER de 11,8% para 21,2%. Compressão e
 * equalização também pioraram; só normalização de volume ficou neutra. O modelo
 * de transcrição foi treinado em áudio sujo e usa o que a limpeza remove — o
 * melhor pré-processamento é nenhum.
 *
 * As outras duas seguem a mesma lógica: `autoGainControl` bombeia o ganho entre
 * a fala e o silêncio (e o modelo transcreve áudio baixo sem perder nada, 12,9%
 * de WER a 18% do volume original), e `echoCancellation` sem sinal de referência
 * não tem eco a cancelar, mas em celular costuma arrastar a captação para o
 * caminho de "voice communication", que é justamente o processado.
 *
 * **Isto ainda não foi confirmado em campo.** A medição acima é um proxy
 * offline: o denoiser do ffmpeg não é o do WebRTC. Por isso
 * `reportTrackSettings` loga o que o navegador REALMENTE aplicou — uma gravação
 * real responde se o pedido foi aceito. Se um dia isto precisar voltar atrás, é
 * este objeto, e nada mais. Ver `docs/transcricao.md`.
 *
 * **Quem abre microfone neste repositório usa ESTE objeto.** O gravador já abriu
 * o microfone por conta própria pedindo os três LIGADOS, para a onda na tela não
 * dançar com o ar-condicionado da sala — uma decisão cosmética tomada sobre o
 * mesmo `MediaStream` que alimenta o `MediaRecorder`, ou seja, pagando a
 * qualidade da transcrição pela estética da animação, sem que nada no código
 * dissesse que havia uma troca ali.
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/**
 * Constraint é PEDIDO, não garantia: o navegador pode ignorar qualquer uma sem
 * avisar, e aí a gravação sai processada enquanto o código acredita que não.
 * `getSettings()` é a única fonte do que valeu de fato.
 */
export function reportTrackSettings(stream: MediaStream) {
  try {
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const s = track.getSettings();
    log.info("settings", {
      echoCancellation: s.echoCancellation ?? null,
      noiseSuppression: s.noiseSuppression ?? null,
      autoGainControl: s.autoGainControl ?? null,
      sampleRate: s.sampleRate ?? null,
      channelCount: s.channelCount ?? null,
    });
  } catch {
    // getSettings não é universal; a ausência do log não pode custar a gravação.
  }
}
