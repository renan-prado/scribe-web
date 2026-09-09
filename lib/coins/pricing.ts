/**
 * Coin ("moeda") pricing — the single source of truth mirrored by the
 * corresponding SQL migration (0017_coin_balance.sql / 0026_billing_stripe.sql).
 * Client-safe: this module is imported by both the API routes and the UI so
 * the price shown on a button matches the amount the server actually debits.
 *
 * Recording modes are billed per started minute (ceil), ticked from the client
 * every 60s. Aprofundar is a flat single-shot charge inside POST /api/deepening.
 *
 * NOTE: this file governs SPENDING only. Crediting lives in lib/billing/* and
 * only ever happens server-side from a verified Stripe webhook.
 */

/** Grant given to a brand-new account. Mirrors the DEFAULT on
 * profiles.coin_balance set in migration 0026. */
export const INITIAL_COIN_BALANCE = 50;

/**
 * Reference used by the coin ring/gauge in the UI to decide "how full" the
 * balance looks. Deliberately NOT the signup grant: since a plan tops the
 * account up to 1.000+ credits, anchoring the gauge to 50 would peg it at
 * 100% forever. 300 ≈ one hour of Modo Estudo, which is the amount that
 * actually feels like "a full tank" to a user about to record.
 */
export const COIN_RING_REFERENCE = 300;

export const COIN_COSTS = {
  /**
   * Per started minute of live recording.
   *
   * 7 e não 5: medido sobre a janela do painel, o minuto ao vivo fechava 63%
   * de margem contra o alvo de 70% da régua. Ele paga transcrição MAIS os três
   * pipelines do feed — é o minuto mais caro do produto, e era o mais barato
   * por moeda.
   */
  liveMinute: 7,
  /**
   * Per started minute of audio-only recording.
   *
   * **5 é PROVISÓRIO, e é uma decisão de produto contra a medição.** O 6
   * anterior veio de uma amostra de 50 execuções: a 2 moedas o modo fechava
   * 24,5% de margem, porque ele dispensa o feed mas NÃO dispensa a transcrição
   * nem o resumo final, que é onde o dinheiro está. Descer para 5 aperta essa
   * margem, e aperta num momento em que o custo de STT ACABOU DE DOBRAR
   * ($0,003 → $0,006 por minuto de áudio — ver docs/transcricao.md). Os dois
   * movimentos vão na mesma direção.
   *
   * Só a transcrição já come R$ 0,032 dos R$ 0,100 que 5 moedas rendem à régua
   * de `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL`; o resumo final vem por cima.
   * Reconfira em `/admin/precificacao` assim que houver execução nova medida.
   */
  audioOnlyMinute: 5,
  /**
   * Per started minute of transcript-only recording (no LLM beyond STT).
   *
   * **3 é PROVISÓRIO, e corrige um prejuízo.** Era 1, e 1 deixou de pagar a
   * conta: o modo faz UMA chamada, a de transcrição, e ela passou de $0,003
   * para $0,006 o minuto de áudio (docs/transcricao.md). À régua de 20 reais o
   * milheiro, 1 moeda rende R$ 0,020 contra R$ 0,032 de custo — cada minuto
   * gravado neste modo dava prejuízo. Já era apertado antes (19% de margem);
   * com o modelo novo virou negativo.
   *
   * A 3 moedas o minuto rende R$ 0,060 contra os mesmos R$ 0,032, ~46% de
   * margem. Fica abaixo dos 70% de `DEFAULT_TARGET_MARGIN_PCT` de propósito:
   * a régua pediria 6, e sextuplicar o preço do modo mais barato do produto é
   * decisão maior que a de parar de perder dinheiro.
   */
  transcriptMinute: 3,
  /**
   * One-shot cost of running /api/deepening.
   *
   * 50 e não 5: o estudo deixou de ser uma chamada de LLM e virou um pipeline
   * de cinco etapas — três delas num modelo de raciocínio — que produz um
   * artigo de três a quatro mil palavras e leva perto de quatro minutos. É a
   * ação mais cara do produto por uma ordem de grandeza, e a única restrita a
   * um plano (ver lib/entitlements/features.ts).
   */
  deepening: 50,
  /**
   * One-shot cost of re-running /api/final-summary/reprocess on a saved
   * session.
   *
   * 15 e não 5: a 5 moedas o reprocessamento rodava NO PREJUÍZO (−5,4% de
   * margem) — ele reexecuta o resumo inteiro sobre a transcrição completa,
   * num modelo grande, e 5 moedas não pagavam a chamada. A régua pedia 18
   * para fechar os 70%; 15 é a decisão do produto, e deixa a margem em ~65%.
   */
  reprocessSummary: 15,
  /**
   * One-shot cost of generating the final summary for a session that was
   * recorded in `transcript_only` and therefore never had one.
   *
   * O MESMO 15 do reprocessamento, e pelo mesmo motivo: é literalmente a mesma
   * chamada — `generateFinalSummary` sobre a transcrição inteira, num modelo
   * grande, mais releia/lembra/frases por cima. O que muda é o que existia
   * antes (nada, em vez de um resumo velho), e isso não altera o custo de um
   * centavo.
   *
   * Preço à parte no ledger porque a PERGUNTA é outra: "quantas pessoas
   * gravaram no modo barato e mudaram de ideia?" é o sinal de produto que diz
   * se o modo transcrição está sendo escolhido por engano. Na tela de
   * precificação as duas somam na mesma linha — ver lib/coins/billable.ts.
   */
  summaryFromTranscript: 15,
  /**
   * One-shot cost of importing a YouTube video: legenda + resumo completo.
   *
   * **25 e FIXO, o único preço do produto que não é por minuto.** Os três modos
   * de captura cobram por minuto porque o custo deles É por minuto — cada
   * minuto de áudio é uma chamada de STT. Uma importação não tem STT: a legenda
   * já existe, custa ~R$ 0,03 de provedor por vídeo (1 crédito da Supadata,
   * qualquer que seja a duração), e o que sobra é exatamente a mesma chamada de
   * `summaryFromTranscript`. Cobrar por minuto de vídeo seria cobrar por um
   * trabalho que não fazemos.
   *
   * A conta, na régua de `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL`: R$ 0,105 de
   * resumo (o número MEDIDO que fixou `summaryFromTranscript` em 15) mais
   * R$ 0,03 de legenda dá R$ 0,135 num vídeo típico. A régua pediria 23 para os
   * 70% de `DEFAULT_TARGET_MARGIN_PCT`; 25 fica acima dela de propósito, porque
   * o custo do resumo cresce com a transcrição na ENTRADA e a receita aqui não
   * cresce com nada. As margens ao longo da faixa:
   *
   * | duração | margem |
   * |---|---|
   * | 30 min | ~70% |
   * | 60 min | ~65% |
   * | 120 min | ~56% |
   *
   * **É `YOUTUBE_MAX_DURATION_MS` que segura a ponta dessa tabela**, e os dois
   * andam sempre juntos: subir o teto sem mexer no preço é escolher a linha de
   * baixo da tabela para todo mundo. Ver `lib/domain/youtube.ts`.
   *
   * 25 também é metade de `INITIAL_COIN_BALANCE`, e isso não é coincidência:
   * quem acabou de criar conta importa dois sermões antes de precisar comprar.
   * É a única porta do produto que não exige esperar até domingo.
   *
   * **Sabendo que ele canibaliza o Modo Resumo.** Os mesmos 45 minutos custam
   * 225 moedas gravados e 25 importados, e para uma igreja que transmite ao
   * vivo os dois caminhos existem. A margem se sustenta nos dois (o custo cai
   * junto com o preço); a receita por sermão, não. Foi decisão de produto
   * tomada com o número à vista, não um efeito colateral que ninguém viu.
   */
  youtubeImport: 25,
  /**
   * Reprocessar roda o MESMO pipeline do zero, então custa o mesmo. Deixá-lo
   * mais barato que a geração abriria uma arbitragem óbvia: gerar uma vez pelo
   * preço cheio e reprocessar indefinidamente pelo preço de banana, pagando 5
   * por um trabalho de 50.
   */
  reprocessDeepening: 50,
} as const;

/**
 * Reason strings persisted in coin_transactions.reason. The server maps each
 * reason to its cost in COIN_COST_BY_REASON — clients never send an amount.
 */
export const CHARGE_REASONS = [
  "live_minute",
  "audio_only_minute",
  "transcript_minute",
  "deepening",
  "reprocess_summary",
  "reprocess_deepening",
  "summary_from_transcript",
  "youtube_import",
] as const;
export type ChargeReason = (typeof CHARGE_REASONS)[number];

export const COIN_COST_BY_REASON: Record<ChargeReason, number> = {
  live_minute: COIN_COSTS.liveMinute,
  audio_only_minute: COIN_COSTS.audioOnlyMinute,
  transcript_minute: COIN_COSTS.transcriptMinute,
  deepening: COIN_COSTS.deepening,
  reprocess_summary: COIN_COSTS.reprocessSummary,
  reprocess_deepening: COIN_COSTS.reprocessDeepening,
  summary_from_transcript: COIN_COSTS.summaryFromTranscript,
  youtube_import: COIN_COSTS.youtubeImport,
};

export function isChargeReason(value: unknown): value is ChargeReason {
  return typeof value === "string" && (CHARGE_REASONS as readonly string[]).includes(value);
}
