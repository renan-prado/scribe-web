import { type SanitizedTranscription, sanitizeTranscription } from "@/lib/transcription/sanitize";

/**
 * Avaliação de qualidade de um chunk transcrito. Combina duas fontes:
 *
 *  1. Assinaturas de alucinação detectadas pela sanitização determinística
 *     (eco de prompt, eco de vocabulário, loop de repetição) — pegam o caso
 *     em que o modelo alucina texto FLUENTE com confiança alta.
 *  2. Confiança do próprio modelo (média de logprobs por token) — pega o
 *     caso oposto: decodificação incerta/embolada de áudio ruim, que sai
 *     sem assinatura conhecida mas com probabilidade baixa.
 *  3. Densidade de texto por segundo de áudio — pega o caso que escapa dos
 *     dois acima: áudio dominado por ruído/música em que o modelo só decodifica
 *     fragmentos esparsos. Os fragmentos saem CONFIANTES (poucos tokens, logprob
 *     ok) e sem assinatura, mas um chunk não-silencioso que rende quase nenhum
 *     texto é o sinal mais direto de que o modelo não está entendendo o áudio.
 *
 * `poor` = qualquer uma das fontes acusou. É o sinal que dispara a escalada
 * de modelo no servidor e a exclusão do chunk como contexto no cliente.
 */

/**
 * Piso de confiança. Fala limpa costuma ficar acima de -0.3; abaixo de -0.6
 * o modelo está visivelmente chutando. Conservador de propósito: falso
 * negativo custa um chunk ruim no feed, falso positivo custa uma chamada
 * extra ao modelo escalado.
 */
export const LOW_CONFIDENCE_AVG_LOGPROB = -0.6;

/**
 * Piso de densidade: chars de texto limpo por segundo de áudio. Fala contínua
 * em pt-BR rende ~12-16 chars/s; mesmo fala pausada (metade do chunk em
 * silêncio) fica acima de 5. Abaixo de 3, o modelo devolveu fragmentos de um
 * áudio que o gate de silêncio do cliente considerou "com som" — ruído ou
 * música, não fala inteligível.
 */
export const LOW_DENSITY_CHARS_PER_SEC = 3;

/**
 * Áudio mínimo pra densidade significar algo. O chunk final de uma gravação
 * (flush do stop) pode ter poucos segundos e legitimamente render pouco texto.
 */
export const LOW_DENSITY_MIN_AUDIO_SECONDS = 8;

export type TranscriptionAssessment = SanitizedTranscription & {
  avgLogprob: number | null;
  lowConfidence: boolean;
  /** Áudio não-silencioso que rendeu texto abaixo do piso de densidade. */
  lowDensity: boolean;
  /** Assinatura de alucinação, baixa confiança OU baixa densidade. */
  poor: boolean;
};

export function assessTranscription(
  raw: string,
  avgLogprob: number | null,
  audioSeconds = 0
): TranscriptionAssessment {
  const sanitized = sanitizeTranscription(raw);
  const lowConfidence = avgLogprob !== null && avgLogprob < LOW_CONFIDENCE_AVG_LOGPROB;
  const lowDensity =
    audioSeconds >= LOW_DENSITY_MIN_AUDIO_SECONDS &&
    sanitized.text.length / audioSeconds < LOW_DENSITY_CHARS_PER_SEC;
  return {
    ...sanitized,
    avgLogprob,
    lowConfidence,
    lowDensity,
    poor: sanitized.suspect || lowConfidence || lowDensity,
  };
}

/**
 * Quantas assinaturas ruins uma avaliação carrega. Usado para comparar o
 * resultado do modelo padrão com o do modelo escalado e ficar com o melhor.
 */
export function assessmentPenalty(a: TranscriptionAssessment): number {
  return (a.suspect ? 1 : 0) + (a.lowConfidence ? 1 : 0) + (a.lowDensity ? 1 : 0);
}

/** `include[]=logprobs` só é aceito pela família gpt-*-transcribe sem diarize. */
export function modelSupportsLogprobs(model: string): boolean {
  return /transcribe/.test(model) && !/diarize/.test(model);
}
