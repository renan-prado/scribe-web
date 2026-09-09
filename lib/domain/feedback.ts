/**
 * O vocabulário do feedback dos usuários — escala, tópicos e superfícies.
 *
 * Client-safe de propósito: os mesmos rótulos desenham os chips do diálogo no
 * navegador e as médias do `/admin/feedback` no servidor. Uma segunda cópia
 * da escala em qualquer um dos dois lados seria a mesma pergunta com dois
 * significados, e a média deixaria de comparar coisas iguais.
 *
 * A escala é TEXTO no banco (ver `0047_feedback.sql`); o número existe só
 * aqui, para a média. Trocar a escala é trocar este arquivo — e nesse dia as
 * notas antigas passam a ser de outra régua, o que a tela precisa dizer.
 */

/**
 * Quatro degraus, e nenhum do meio.
 *
 * Uma escala ímpar (1-5, "regular" no centro) recebe o voto de quem não quer
 * pensar, e a moda cai no centro em todo produto que já se mediu. Com quatro,
 * a pessoa é obrigada a cair de um lado — que é a informação que a pergunta
 * existe para colher.
 */
export const FEEDBACK_RATINGS = ["ruim", "razoavel", "boa", "excelente"] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

/** O que a pessoa lê no chip. `razoavel` é sem acento no banco, com acento na tela. */
export const FEEDBACK_RATING_LABEL: Record<FeedbackRating, string> = {
  ruim: "Ruim",
  razoavel: "Razoável",
  boa: "Boa",
  excelente: "Excelente",
};

/** O emoji do chip. Ele carrega o tom antes da leitura — quem só bate o olho
 * na janela já sabe qual ponta é qual sem ler as quatro palavras. */
export const FEEDBACK_RATING_EMOJI: Record<FeedbackRating, string> = {
  ruim: "😕",
  razoavel: "😐",
  boa: "🙂",
  excelente: "🤩",
};

/** 1 a 4. A média do painel sai daqui, e é o ÚNICO lugar onde a escala vira número. */
export const FEEDBACK_RATING_SCORE: Record<FeedbackRating, number> = {
  ruim: 1,
  razoavel: 2,
  boa: 3,
  excelente: 4,
};

export function isFeedbackRating(value: unknown): value is FeedbackRating {
  return (FEEDBACK_RATINGS as readonly string[]).includes(value as string);
}

/**
 * ONDE a pergunta foi feita. Espelha os três modos de captura
 * (`lib/domain/session.ts`) mais o estudo e o feedback avulso do /profile.
 */
export const FEEDBACK_SURFACES = ["live", "audio", "transcript", "study", "general"] as const;
export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number];

/**
 * SOBRE O QUE é a nota. É o eixo do painel: cada tópico é uma peça do produto
 * com um conserto próprio, e por isso eles não se somam numa nota geral.
 *
 * `summary` é o mesmo tópico no modo Ao Vivo e no modo Áudio de propósito —
 * é o mesmo pipeline (`final-summary`) produzindo o mesmo artefato. Separá-los
 * partiria a amostra ao meio sem responder nenhuma pergunta nova.
 */
export const FEEDBACK_TOPICS = [
  /** Os cards que aparecem DURANTE a pregação (bible, insights, sermon-echo). */
  "live_suggestions",
  /** O resumo estruturado do fim — modos `live` e `audio_only`. */
  "summary",
  /** O texto transcrito em si — modo `transcript_only`. */
  "transcript",
  /** O estudo aprofundado gerado sob demanda. */
  "study",
  /** O produto inteiro. Só do /profile, e nunca misturado com os outros. */
  "overall",
] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export function isFeedbackTopic(value: unknown): value is FeedbackTopic {
  return (FEEDBACK_TOPICS as readonly string[]).includes(value as string);
}

/** O rótulo curto do painel. */
export const FEEDBACK_TOPIC_LABEL: Record<FeedbackTopic, string> = {
  live_suggestions: "Sugestões ao vivo",
  summary: "Resumo gerado",
  transcript: "Transcrição",
  study: "Estudo aprofundado",
  overall: "Experiência geral",
};

/**
 * A pergunta, como ela aparece no diálogo. Curta e concreta: "o que você
 * achou do resumo?" é respondível de imediato; "avalie sua experiência" faz a
 * pessoa parar para decidir do que está falando, e é aí que ela fecha a
 * janela.
 */
export const FEEDBACK_TOPIC_QUESTION: Record<FeedbackTopic, string> = {
  live_suggestions: "O que você achou das sugestões que apareceram durante a pregação?",
  summary: "E do resumo que geramos no final?",
  transcript: "O que você achou da transcrição?",
  study: "O que você achou do estudo?",
  overall: "Como está sendo sua experiência com o Scriba?",
};

/**
 * Os tópicos de cada superfície, na ordem em que o diálogo pergunta.
 *
 * O Ao Vivo pergunta DUAS coisas porque entrega duas — e quem gostou dos
 * cards e achou o resumo fraco não tem como dizer isso numa nota só. As
 * outras superfícies entregam uma coisa; perguntar duas ali seria inventar
 * uma pergunta para preencher a janela.
 */
export const FEEDBACK_TOPICS_BY_SURFACE: Record<FeedbackSurface, readonly FeedbackTopic[]> = {
  live: ["live_suggestions", "summary"],
  audio: ["summary"],
  transcript: ["transcript"],
  study: ["study"],
  general: ["overall"],
};

/**
 * Limite do texto livre. O mesmo 300 de `MAX_HALLUCINATION_NOTE_CHARS`, pela
 * mesma razão: o valor está em dizer O QUE incomodou, não em escrever um
 * relatório — e um campo que aceita mil caracteres faz quem tem uma frase
 * achar que a frase é pouco e não escrever nada.
 */
export const MAX_FEEDBACK_COMMENT_CHARS = 300;

/**
 * A 1ª, a 3ª e a 8ª. Ver o cabeçalho de `0047_feedback.sql` para o porquê de
 * cada uma; o resumo é que a primeira impressão só existe uma vez, a terceira
 * é a janela em que se desiste, e a oitava é a opinião de quem já sabe do que
 * está falando.
 */
export const FEEDBACK_MILESTONES = [1, 3, 8] as const;

export function isFeedbackMilestone(ordinal: number): boolean {
  return (FEEDBACK_MILESTONES as readonly number[]).includes(ordinal);
}

/** O que a pergunta cobre, dita no topo do diálogo. */
export const FEEDBACK_SURFACE_INTRO: Record<FeedbackSurface, string> = {
  live: "Você acabou de gravar ao vivo. Como foi?",
  audio: "Sua gravação está pronta. Como foi?",
  transcript: "Sua transcrição está pronta. Como foi?",
  study: "Seu estudo está pronto. Como foi?",
  general: "Sua opinião muda o que a gente constrói em seguida.",
};

/**
 * A média de um conjunto de notas, em 1..4 — ou `null` quando não há nota.
 *
 * `null` e não zero: zero é uma nota abaixo de "ruim", que não existe na
 * escala, e um painel que mostra 0,00 onde ninguém respondeu convida a
 * concluir que a parte é péssima quando o que houve foi silêncio.
 */
export function averageRating(ratings: readonly FeedbackRating[]): number | null {
  if (ratings.length === 0) return null;
  let total = 0;
  for (const r of ratings) total += FEEDBACK_RATING_SCORE[r];
  return total / ratings.length;
}
