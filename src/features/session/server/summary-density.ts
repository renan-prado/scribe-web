import "server-only";

/**
 * O ALVO DE TAMANHO E DE ESTRUTURA do resumo, derivado da própria transcrição.
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
 * prompt. Pedir mais palavras aqui não aumenta risco de alucinação como
 * aumentaria num texto autoral: o trabalho é condensar o que foi dito, e o que
 * falta no resumo curto é material que ESTÁ na transcrição e foi descartado.
 *
 * ## O alvo é DOIS, e o segundo é o que funciona
 *
 * `minWords`/`maxWords` são a intenção; `movements` é o que o modelo consegue
 * obedecer. **Nenhum LLM conta palavras** — ele não tem como somar o que ainda
 * não escreveu —, então um alvo em palavras é lido como um humor ("mais longo
 * que o normal") e não como um requisito. Já "oito movimentos, cada um com 4 a
 * 7 parágrafos" é discreto, verificável enquanto ele escreve, e produz o
 * comprimento como CONSEQUÊNCIA. Os dois vão no prompt, e a estrutura é a que
 * manda quando eles discordarem.
 *
 * ## A curva, e por que ela não é uma porcentagem só
 *
 * A proporção CAI conforme a fita cresce. Um devocional de 10 minutos tem
 * pouca gordura, e metade dele ainda é um texto pequeno; uma transmissão de
 * duas horas tem repetição, saudação e recado de igreja, e metade dela seria
 * um documento que ninguém lê.
 */
const TIERS = [
  { upTo: 2_000, share: 0.55 },
  { upTo: 6_000, share: 0.42 },
  { upTo: Number.POSITIVE_INFINITY, share: 0.22 },
] as const;

/** Piso: abaixo disso não é resumo, é legenda. */
const MIN_TARGET_WORDS = 300;
/**
 * Teto. Ele deixou de ser um limite de `maxTokens` quando a redação passou a
 * ser por TRECHO (ver `final-summary.ts`): cada chamada escreve a fatia dela,
 * então o teto aqui é editorial, e não técnico. Acima disso o que falta não é
 * tamanho, é edição.
 */
const MAX_TARGET_WORDS = 4_000;

/** Palavras que um `paragraph` denso costuma ter, usado só para virar blocos. */
const WORDS_PER_BLOCK_MAX = 85;
const WORDS_PER_BLOCK_MIN = 55;

/** Um movimento (h1) com os 4 a 7 parágrafos densos que o prompt pede. */
const WORDS_PER_MOVEMENT = 260;
const MIN_MOVEMENTS = 3;
const MAX_MOVEMENTS = 12;

export function countTranscriptWords(transcript: string): number {
  const matches = transcript.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export type SummaryDensityTarget = {
  transcriptWords: number;
  targetWords: number;
  minWords: number;
  maxWords: number;
  minBlocks: number;
  maxBlocks: number;
  movements: number;
};

export function resolveSummaryDensity(transcriptWords: number): SummaryDensityTarget {
  let remaining = transcriptWords;
  let previousCeiling = 0;
  let raw = 0;

  for (const tier of TIERS) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, tier.upTo - previousCeiling);
    raw += band * tier.share;
    remaining -= band;
    previousCeiling = tier.upTo;
  }

  const targetWords = Math.round(Math.min(MAX_TARGET_WORDS, Math.max(MIN_TARGET_WORDS, raw)));

  return {
    transcriptWords,
    targetWords,
    minWords: Math.round(targetWords * 0.9),
    maxWords: Math.round(targetWords * 1.25),
    minBlocks: Math.max(8, Math.round(targetWords / WORDS_PER_BLOCK_MAX)),
    maxBlocks: Math.max(12, Math.round(targetWords / WORDS_PER_BLOCK_MIN)),
    movements: Math.min(
      MAX_MOVEMENTS,
      Math.max(MIN_MOVEMENTS, Math.round(targetWords / WORDS_PER_MOVEMENT))
    ),
  };
}

/**
 * A fatia de um TRECHO, quando a redação é por trecho: o alvo total repartido
 * na proporção das palavras faladas naquele pedaço, para que nenhuma parte da
 * pregação receba menos atenção que outra só por estar no fim.
 */
export function sliceDensity(
  total: SummaryDensityTarget,
  sliceWords: number
): SummaryDensityTarget {
  const share = total.transcriptWords > 0 ? sliceWords / total.transcriptWords : 1;
  const targetWords = Math.max(150, Math.round(total.targetWords * share));

  return {
    transcriptWords: sliceWords,
    targetWords,
    minWords: Math.round(targetWords * 0.9),
    maxWords: Math.round(targetWords * 1.25),
    minBlocks: Math.max(4, Math.round(targetWords / WORDS_PER_BLOCK_MAX)),
    maxBlocks: Math.max(6, Math.round(targetWords / WORDS_PER_BLOCK_MIN)),
    movements: Math.max(1, Math.round(total.movements * share)),
  };
}

/**
 * O bloco que vai na MENSAGEM DO USUÁRIO, junto da transcrição, e não no
 * system prompt: são números desta transcrição, não regra do produto. O
 * system prompt manda obedecê-los.
 */
export function buildDensityBriefing(
  target: SummaryDensityTarget,
  scope: "inteira" | "trecho"
): string {
  const head =
    scope === "inteira"
      ? `medida desta transcrição:
- palavras faladas na pregação inteira: ${target.transcriptWords}`
      : `medida DESTE TRECHO:
- palavras faladas no trecho: ${target.transcriptWords}`;

  return `${head}
- movimentos (h1) a escrever: ${target.movements}
- parágrafos por movimento: 4 a 7, densos
- total de blocks: ${target.minBlocks} a ${target.maxBlocks}
- palavras somando o texto dos blocks do SERMÃO: ${target.minWords} a ${target.maxWords} (blocks "noteReply" não contam aqui, ver a seção das notas)

O número de MOVIMENTOS é o requisito firme: conte-os enquanto escreve. A faixa de palavras é a consequência esperada dele. Ficar abaixo é o erro mais comum e mais caro; só se justifica se o material realmente não existir (avisos, música, fala repetida), nunca por economia. Encher com floreio ou repetição também é erro.`;
}
