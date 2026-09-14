/**
 * Como uma sessão nasceu. Client-safe.
 *
 * - `audio`: o microfone. Grava um arquivo só, transcreve no stop, resume.
 * - `youtube`: NÃO CAPTURA NADA. A transcrição vem pronta das legendas de um
 *   vídeo e o resumo roda sobre ela.
 *
 * **Eram quatro, e a diferença entre três deles era o que rodava DURANTE a
 * pregação.** `live` mantinha três pipelines de enriquecimento alimentando um
 * feed ao vivo; `transcript_only` não gerava resumo; `audio_only` ficava no
 * meio. Os três foram removidos: o produto é gravar, resumir e, se a pessoa
 * quiser, aprofundar. Um modo de captura só.
 *
 * **`youtube` é o modo que não grava, e mora aqui assim mesmo.** A alternativa
 * era um conceito novo ao lado de sessão, e o que uma importação precisa ser
 * (linha na Biblioteca, transcrição, resumo, estudo) é exatamente o que uma
 * sessão já é. O preço dele é o único que não é por minuto: um vídeo custa
 * `COIN_COSTS.youtubeImport`, cobrado uma vez, porque não há minuto de STT para
 * contar. Ver `lib/coins/pricing.ts`.
 */
export const SESSION_MODES = ["audio", "youtube"] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

/**
 * Os três nomes antigos continuam existindo em linhas gravadas antes da
 * unificação (migração 0057) e em qualquer cliente que não recarregou.
 * Todos eles gravaram áudio pelo microfone, então todos são `audio` aqui.
 */
const LEGACY_MODES: Record<string, SessionMode> = {
  live: "audio",
  audio_only: "audio",
  transcript_only: "audio",
};

export function parseSessionMode(value: unknown): SessionMode {
  if ((SESSION_MODES as readonly string[]).includes(value as string)) {
    return value as SessionMode;
  }
  return LEGACY_MODES[value as string] ?? "audio";
}
