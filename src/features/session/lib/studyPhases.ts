import type { OverlayPhase } from "@/components/PageBlurOverlay";

/**
 * As fases mostradas enquanto o estudo é gerado.
 *
 * Elas espelham o pipeline real de `lib/study/generate.ts` — perguntar,
 * responder, escrever, conferir — e não uma barra de progresso decorativa. O
 * usuário espera cerca de quatro minutos; dizer o que está acontecendo transforma
 * a espera em expectativa, e ainda explica por que o estudo custa moedas.
 *
 * ⚠️ Os tempos são ESTIMATIVA, não medição: não há SSE no app, então o
 * servidor não reporta em que etapa está. Os valores vêm das latências
 * medidas com `tmp/dev-scripts/study-eval.mts` — hoje ~255s no total, num
 * modelo de raciocínio. Trocar o modelo do pipeline muda estes números.
 *
 * Se a geração terminar antes, o overlay some no meio de uma fase; se demorar
 * mais, a última fica de pé — por isso a última é a única frase escrita para
 * envelhecer parada.
 *
 * Ao mudar o pipeline, mude estas fases junto: um overlay que anuncia uma
 * etapa que não existe mais é pior que um overlay mudo.
 */
export const STUDY_GENERATION_PHASES: OverlayPhase[] = [
  {
    title: "Lendo a mensagem",
    subtitle: "Recuperando a transcrição, o resumo e os cartões desta sessão.",
    holdMs: 8_000,
  },
  {
    title: "Levantando perguntas",
    subtitle: "O que este tema deixa em aberto? O que um ouvinte atento perguntaria depois?",
    holdMs: 52_000,
  },
  {
    title: "Buscando as respostas",
    subtitle: "Escritura, história da doutrina e as vozes da tradição cristã.",
    holdMs: 95_000,
  },
  {
    title: "Escrevendo o estudo",
    subtitle: "Costurando tudo num texto que se lê do começo ao fim.",
    holdMs: 100_000,
  },
  {
    title: "Conferindo as fontes",
    subtitle: "Cada versículo é conferido na Bíblia, e citação sem obra conhecida fica de fora.",
    holdMs: 0,
  },
];

/**
 * Reprocessar roda exatamente o mesmo pipeline — as fases são as mesmas, e só
 * a primeira muda de nome para o usuário entender que o estudo antigo será
 * substituído, não complementado.
 */
export const STUDY_REPROCESS_PHASES: OverlayPhase[] = [
  { ...STUDY_GENERATION_PHASES[0], title: "Relendo a mensagem" },
  ...STUDY_GENERATION_PHASES.slice(1),
];
