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
 * `poor` = qualquer uma das fontes acusou. É o sinal que exclui o chunk do
 * contexto (prevText) e dos pipelines no cliente, e que, repetido, acende o
 * aviso de áudio ruim na tela. Ele NÃO troca de modelo: não existe modelo
 * melhor que o padrão para escalar — ver o comentário em
 * `app/api/transcribe/route.ts`.
 */

/**
 * Piso de confiança, calibrado para `gpt-transcribe`.
 *
 * O valor anterior era -0.6, herdado do `gpt-4o-mini-transcribe`, e com o
 * modelo novo ele **nunca disparava**. Medição sobre um sermão real com
 * transcrição de referência, degradado em passos de reverberação:
 *
 * | avgLogprob | WER  |
 * |-----------:|-----:|
 * |     -0.046 |  14% |
 * |     -0.062 |  19% |
 * |     -0.105 |  27% |
 * |     -0.118 |  35% |
 * |     -0.157 |  49% |
 * |     -0.227 |  85% |
 *
 * O `gpt-transcribe` é MUITO mais confiante que o mini: em todo áudio ainda
 * utilizável ele fica entre -0.045 e -0.073, e a partir de -0.10 a
 * transcrição já está errando um quarto das palavras. Daí o -0.10 — ele marca
 * a linha em que o áudio começa a custar conteúdo, não a em que o modelo
 * desiste.
 *
 * Isso não é ajuste fino: com -0.6, o áudio que motivou este trabalho (27% de
 * WER, chunks a -0.392/-0.105/-0.071) passava inteiro como bom, e o aviso de
 * qualidade que existe para essa exata situação não aparecia uma vez sequer.
 *
 * **Trocar `OPENAI_TRANSCRIBE_MODEL` obriga a recalibrar este número.** Ele é
 * uma propriedade do decodificador, não do áudio.
 */
export const LOW_CONFIDENCE_AVG_LOGPROB = -0.1;

/**
 * Piso de densidade: chars de texto limpo por segundo de áudio. Abaixo de 3, o
 * modelo devolveu fragmentos de um áudio que o gate de silêncio do cliente
 * considerou "com som" — ruído ou música, não fala inteligível.
 *
 * O comentário anterior dizia "fala contínua rende ~12-16 chars/s". Medido num
 * sermão real, a pregação rende **8**: o púlpito tem pausa retórica, e o ritmo
 * de quem prega não é o de quem conversa. O piso continua em 3 porque ele é o
 * detector de CATÁSTROFE (áudio inutilizável mede 2,4-3,4), e subi-lo para
 * perto de 8 transformaria uma pausa longa em alarme. Quem pega a faixa do
 * meio — áudio ruim mas ainda com fala — é o logprob acima.
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

/** `include[]=logprobs` só é aceito pela família gpt-*-transcribe sem diarize. */
export function modelSupportsLogprobs(model: string): boolean {
  return /transcribe/.test(model) && !/diarize/.test(model);
}
