import "server-only";

/**
 * Partir a transcrição em TRECHOS sequenciais, para a redação por trecho.
 *
 * O corte é sempre em FRONTEIRA DE FRASE, nunca no meio de uma. Cortar por
 * contagem crua de palavras entrega ao modelo um pedaço que começa em "…e foi
 * aí que ele" e outro que termina em "o carcereiro pegou a", e ele gasta o
 * começo de cada trecho adivinhando o que ficou do outro lado.
 *
 * Não há SOBREPOSIÇÃO entre os trechos, de propósito: o que costura um no
 * outro é a lista de movimentos já escritos, que vai no prompt do trecho
 * seguinte. Repetir o fim do trecho anterior faria o mesmo argumento ser
 * redigido duas vezes, e um parágrafo repetido é o defeito mais visível que
 * este resumo pode ter.
 */

/** Fim de frase, ou quebra de linha da transcrição. */
const SENTENCE_END = /(?<=[.!?…])\s+|\n+/;

export type TranscriptSlice = {
  text: string;
  words: number;
  /** 1-based, para o prompt dizer "trecho 2 de 3". */
  index: number;
  isLast: boolean;
};

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function sliceTranscript(transcript: string, sliceCount: number): TranscriptSlice[] {
  const trimmed = transcript.trim();
  if (sliceCount <= 1) {
    return [{ text: trimmed, words: countWords(trimmed), index: 1, isLast: true }];
  }

  const sentences = trimmed.split(SENTENCE_END).filter((s) => s.trim().length > 0);
  const totalWords = countWords(trimmed);
  const wordsPerSlice = totalWords / sliceCount;

  const buckets: string[][] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    current.push(sentence.trim());
    currentWords += countWords(sentence);
    // O último balde leva todo o resto: fechar o penúltimo por contagem e
    // deixar três frases sozinhas no fim daria um trecho final que não tem
    // mensagem nenhuma, só o "amém".
    if (currentWords >= wordsPerSlice && buckets.length < sliceCount - 1) {
      buckets.push(current);
      current = [];
      currentWords = 0;
    }
  }
  if (current.length > 0) buckets.push(current);

  return buckets.map((sentencesInBucket, i) => {
    const text = sentencesInBucket.join(" ");
    return {
      text,
      words: countWords(text),
      index: i + 1,
      isLast: i === buckets.length - 1,
    };
  });
}
