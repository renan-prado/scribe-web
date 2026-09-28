import "server-only";

/**
 * O ALVO DE TAMANHO DO RESUMO, derivado da própria transcrição.
 *
 * ## Por que isto existe
 *
 * O prompt do resumo sempre pediu "densidade adaptativa", mas calibrava por
 * sinais que o modelo NÃO tem como medir: a duração em minutos, o tamanho do
 * feed (que morreu junto com o modo `live`), a "densidade doutrinária". Diante
 * de um alvo subjetivo, o modelo encolhe: uma pregação de 5.128 palavras saiu
 * com 718 (14%), enquanto o mesmo prompt pedia 40-55% do peso argumentativo.
 * Não é alucinação nem falta de material, é falta de RÉGUA.
 *
 * A contagem de palavras da transcrição é a única medida que temos de graça,
 * é exata e não depende de o modelo estimar nada. Então ela vira número no
 * prompt: "a transcrição tem N palavras, o resumo tem de ficar entre X e Y".
 * Pedir mais palavras aqui não aumenta risco de alucinação como aumentaria num
 * texto autoral: o trabalho é condensar o que foi dito, e o que falta no
 * resumo curto é material que ESTÁ na transcrição e foi descartado.
 *
 * ## A curva, e por que ela não é uma porcentagem só
 *
 * A proporção CAI conforme a fita cresce. Um devocional de 10 minutos tem
 * pouca gordura, e 35% dele ainda é um texto pequeno; uma transmissão de duas
 * horas tem repetição, saudação e recado de igreja, e 35% dela seria um
 * documento que ninguém lê (e uma chamada de saída cara, perto do teto de
 * `maxTokens`). Daí as três faixas abaixo.
 */
const TIERS = [
  { upTo: 2_000, share: 0.35 },
  { upTo: 6_000, share: 0.25 },
  { upTo: Number.POSITIVE_INFINITY, share: 0.15 },
] as const;

/** Piso: abaixo disso não é resumo, é legenda. */
const MIN_TARGET_WORDS = 250;
/**
 * Teto: ~4.500 tokens de texto, que com o JSON ao redor ainda cabe folgado nos
 * 12.000 de `maxTokens`. O teto existe para a transmissão de 2h, não para o
 * sermão: acima dele o que falta não é tamanho, é edição.
 */
const MAX_TARGET_WORDS = 3_000;

/** Palavras que um `paragraph` denso costuma ter, usado só para virar blocos. */
const WORDS_PER_BLOCK_MAX = 85;
const WORDS_PER_BLOCK_MIN = 55;

export function countTranscriptWords(transcript: string): number {
  const matches = transcript.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export type SummaryDensityTarget = {
  transcriptWords: number;
  minWords: number;
  maxWords: number;
  minBlocks: number;
  maxBlocks: number;
};

export function resolveSummaryDensity(transcriptWords: number): SummaryDensityTarget {
  let remaining = transcriptWords;
  let previousCeiling = 0;
  let target = 0;

  for (const tier of TIERS) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, tier.upTo - previousCeiling);
    target += band * tier.share;
    remaining -= band;
    previousCeiling = tier.upTo;
  }

  const clamped = Math.round(Math.min(MAX_TARGET_WORDS, Math.max(MIN_TARGET_WORDS, target)));

  return {
    transcriptWords,
    minWords: Math.round(clamped * 0.85),
    maxWords: Math.round(clamped * 1.2),
    minBlocks: Math.max(8, Math.round(clamped / WORDS_PER_BLOCK_MAX)),
    maxBlocks: Math.max(12, Math.round(clamped / WORDS_PER_BLOCK_MIN)),
  };
}

/**
 * O bloco que vai na MENSAGEM DO USUÁRIO, junto da transcrição, e não no
 * system prompt: são números desta transcrição, não regra do produto. O
 * system prompt manda obedecê-los.
 */
export function buildDensityBriefing(target: SummaryDensityTarget): string {
  return `medida desta transcrição:
- palavras faladas: ${target.transcriptWords}
- o sermão organizado deve ter entre ${target.minWords} e ${target.maxWords} palavras somando o texto de TODOS os blocks
- e entre ${target.minBlocks} e ${target.maxBlocks} blocks
Ficar abaixo dessa faixa é ERRO, e é o erro mais comum. Só se justifica se a transcrição realmente não tiver material (fala repetida, avisos, silêncio); encher com floreio ou repetição também é erro.`;
}
