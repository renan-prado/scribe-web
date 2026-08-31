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

export type TranscriptionAssessment = SanitizedTranscription & {
  avgLogprob: number | null;
  lowConfidence: boolean;
  /** Assinatura de alucinação OU baixa confiança — chunk de qualidade ruim. */
  poor: boolean;
};

export function assessTranscription(
  raw: string,
  avgLogprob: number | null
): TranscriptionAssessment {
  const sanitized = sanitizeTranscription(raw);
  const lowConfidence = avgLogprob !== null && avgLogprob < LOW_CONFIDENCE_AVG_LOGPROB;
  return {
    ...sanitized,
    avgLogprob,
    lowConfidence,
    poor: sanitized.suspect || lowConfidence,
  };
}

/**
 * Quantas assinaturas ruins uma avaliação carrega. Usado para comparar o
 * resultado do modelo padrão com o do modelo escalado e ficar com o melhor.
 */
export function assessmentPenalty(a: TranscriptionAssessment): number {
  return (a.suspect ? 1 : 0) + (a.lowConfidence ? 1 : 0);
}

/** `include[]=logprobs` só é aceito pela família gpt-*-transcribe sem diarize. */
export function modelSupportsLogprobs(model: string): boolean {
  return /transcribe/.test(model) && !/diarize/.test(model);
}
