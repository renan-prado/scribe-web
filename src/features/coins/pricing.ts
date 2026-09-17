/**
 * Coin ("moeda") pricing, the single source of truth mirrored by the
 * corresponding SQL migration (0017_coin_balance.sql / 0026_billing_stripe.sql).
 * Client-safe: this module is imported by both the API routes and the UI so
 * the price shown on a button matches the amount the server actually debits.
 *
 * A gravação é cobrada por minuto INICIADO (ceil), pulsada pelo cliente a
 * cada 60s. O resto do produto é cobrança única: importar um vídeo,
 * aprofundar, reprocessar.
 *
 * NOTE: this file governs SPENDING only. Crediting lives in lib/billing/* and
 * only ever happens server-side from a verified Stripe webhook.
 */

/** Grant given to a brand-new account. Mirrors the DEFAULT on
 * profiles.coin_balance set in migration 0026. */
export const INITIAL_COIN_BALANCE = 50;

/**
 * Referência do anel do saldo, para decidir "quão cheio" ele parece.
 *
 * **Ele vale só para quem NÃO assina**, e isso é o conserto de um defeito que
 * o comentário original já admitia sem resolver: ancorar o medidor em 50 o
 * deixaria em 100% para sempre num plano de 1.000 créditos — só que 1.000 e
 * 2.500 também o deixam. Para todo assinante este anel marcava 100% desde o
 * primeiro dia e nunca saía de lá, um enfeite dourado que não informava nada.
 *
 * Hoje o assinante tem outro anel: o crédito do MÊS restante, medido contra a
 * franquia que ele de fato recebeu (`lib/db/coins.ts#getCycleUsage`). Este
 * continua sendo o certo para a conta gratuita, onde não há renovação e o saldo
 * absoluto é a informação que decide se a pessoa grava o culto de domingo.
 * 300 ≈ uma hora de gravação, que é o que parece "tanque cheio" para quem está
 * prestes a gravar. Ver `docs/creditos-na-tela.md`.
 */
export const COIN_RING_REFERENCE = 300;

export const COIN_COSTS = {
  /**
   * Por minuto iniciado de gravação. O ÚNICO preço por minuto do produto.
   *
   * **5 é PROVISÓRIO, e é uma decisão de produto contra a medição.** Eram três
   * modos, a 7, 5 e 3 moedas o minuto; o de 5 era o do meio e é o que sobrou,
   * porque é exatamente o que o produto faz hoje: transcreve e resume. A 5 a
   * margem é apertada, e aperta num momento em que o custo de STT ACABOU DE
   * DOBRAR ($0,003 → $0,006 por minuto de áudio, ver docs/transcricao.md).
   *
   * Só a transcrição já come R$ 0,032 dos R$ 0,100 que 5 moedas rendem à régua
   * de `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL`; o resumo final vem por cima.
   * Reconfira em `/admin/custos` assim que houver execução nova medida.
   */
  recordingMinute: 5,
  /**
   * One-shot cost of running /api/deepening.
   *
   * 50 e não 5: o estudo deixou de ser uma chamada de LLM e virou um pipeline
   * de cinco etapas, três delas num modelo de raciocínio, que produz um
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
   * margem), ele reexecuta o resumo inteiro sobre a transcrição completa,
   * num modelo grande, e 5 moedas não pagavam a chamada. A régua pedia 18
   * para fechar os 70%; 15 é a decisão do produto, e deixa a margem em ~65%.
   */
  reprocessSummary: 15,
  /**
   * One-shot cost of importing a YouTube video: legenda + resumo completo.
   *
   * **30 e FIXO, o único preço do produto que não é por minuto.** A gravação
   * cobra por minuto porque o custo dela É por minuto: cada minuto de áudio é
   * uma chamada de STT. Uma importação não tem STT: a legenda já existe, custa
   * ~R$ 0,03 de provedor por vídeo (1 crédito da Supadata, qualquer que seja a
   * duração), e o que sobra é exatamente a mesma chamada de resumo.
   * Cobrar por minuto de vídeo seria cobrar por um trabalho que não fazemos.
   *
   * A conta, na régua de `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL`: R$ 0,105 de
   * resumo (o número MEDIDO que fixou `reprocessSummary` em 15) mais
   * R$ 0,03 de legenda dá R$ 0,135 num vídeo típico. A régua pediria 23 para os
   * 70% de `DEFAULT_TARGET_MARGIN_PCT` NESSE vídeo típico, mas o custo do
   * resumo cresce com a transcrição na ENTRADA e a receita aqui não cresce com
   * nada, então o preço tem de ser fixado pela ponta longa, não pelo meio.
   *
   * **Era 25, e 25 só alcançava a régua no vídeo curto.** As margens ao longo
   * da faixa, antes e depois:
   *
   * | duração | a 25 | a 30 |
   * |---|---|---|
   * | 30 min | ~70% | ~75% |
   * | 60 min | ~65% | ~71% |
   * | 120 min | ~56% | ~63% |
   *
   * A 30 o alvo de 70% passa a valer na faixa em que quase todo sermão cai (até
   * uma hora), e só o vídeo de duas horas, o teto, fica abaixo dele.
   *
   * **É `YOUTUBE_MAX_DURATION_MS` que segura a ponta dessa tabela**, e os dois
   * andam sempre juntos: subir o teto sem mexer no preço é escolher a linha de
   * baixo da tabela para todo mundo. Ver `lib/domain/youtube.ts`.
   *
   * Com `INITIAL_COIN_BALANCE` em 50, uma conta nova importa UM vídeo e ainda
   * fica com 20 moedas, o suficiente para experimentar um pedaço de gravação
   * depois. Era metade do saldo (dois vídeos) a 25, e trocar o segundo vídeo
   * grátis por sete pontos de margem é a decisão que este número carrega: a
   * porta que não exige esperar até domingo continua aberta, só não duas vezes.
   *
   * **Sabendo que ele canibaliza a gravação.** Os mesmos 45 minutos custam
   * 225 moedas gravados e 30 importados, e para uma igreja que transmite ao
   * vivo os dois caminhos existem. A margem se sustenta nos dois (o custo cai
   * junto com o preço); a receita por sermão, não. Foi decisão de produto
   * tomada com o número à vista, não um efeito colateral que ninguém viu.
   */
  youtubeImport: 30,
  /**
   * Reprocessar roda o MESMO pipeline do zero, então custa o mesmo. Deixá-lo
   * mais barato que a geração abriria uma arbitragem óbvia: gerar uma vez pelo
   * preço cheio e reprocessar indefinidamente pelo preço de banana, pagando 5
   * por um trabalho de 50.
   */
  reprocessDeepening: 50,
  /**
   * UMA mensagem ao Biblo, a conversa dentro da sessão.
   *
   * **2 e não 1, e o preço nunca aparece na tela.** Na régua de
   * `DEFAULT_COIN_PRICE_PER_THOUSAND_BRL`, uma moeda vale R$ 0,02, então uma
   * mensagem rende R$ 0,04.
   *
   * **MEDIDO** (`tmp/dev-scripts/biblo-eval.mts`, quatro execuções reais em
   * `gpt-4.1-mini` sobre um resumo de cinco blocos, com a janela deslizante e
   * os dois tetos de `BIBLO_ANSWER_MAX_TOKENS` / `BIBLO_SUMMARY_TOKEN_BUDGET`
   * no lugar):
   *
   * | | entrada | saída | custo | margem a 2 |
   * |---|---|---|---|---|
   * | cache frio | ~1.300 | ~250 | R$ 0,0046 – 0,0055 | **86–88%** |
   * | cache quente | ~1.270 (1.024 em cache) | ~250 | R$ 0,0032 | **92%** |
   *
   * A ESTIMATIVA que fixou este preço era R$ 0,0103, ou seja, ela errou para o
   * lado seguro por um fator de dois. Um resumo de verdade é maior que o do
   * teste (~2.000 tokens contra ~500), o que acrescenta na casa de R$ 0,003 por
   * mensagem: o caso real fica perto de R$ 0,008 no pior cenário, com margem
   * ~80%. Nenhum cenário medido chega perto do prejuízo.
   *
   * **Os dois tetos são o que garante isso.** Sem limite no tamanho da resposta
   * e do resumo, o custo de uma mensagem não tem teto superior nenhum — cresce
   * com a transcrição na entrada e com a prolixidade na saída. Era esse caso
   * (R$ 0,0237) que condenava o preço de 1 moeda, o mesmo buraco em que
   * `reprocessSummary` esteve a 5.
   *
   * **2 é o número de PARTIDA, e o ajuste provável é para BAIXO.** É fácil
   * baixar um preço e caro subir: cair para 1 depois da medição em produção é
   * um presente que se anuncia, subir de 1 para 2 é a única mudança de preço
   * que gera reclamação. A medição acima é de BANCADA, com um resumo pequeno e
   * sem conversa longa atrás — reconfira em `/admin/custos` (linha "Biblo")
   * assim que houver tráfego real, olhando a fatia de chamadas que pegou cache.
   *
   * A elegância de "uma moeda por mensagem" não compra nada aqui porque **o
   * preço é invisível**: o saldo do assinante deixa de ser um número na barra
   * (ver `docs/creditos-na-tela.md`), então ninguém lê a unidade. O que se
   * sente é o ritmo em que o anel anda, e a 2 moedas uma conversa de 40
   * mensagens são 8% de um plano Pessoal.
   */
  bibloMessage: 2,
} as const;

/**
 * O presente: mensagens que a conta GRATUITA usa antes de conhecer o preço.
 *
 * **Uma vez por CONTA, nunca por sessão.** Abrir uma sessão não custa nada
 * (`/escrever` é o caminho gratuito do produto), então dez mensagens por
 * sessão seriam dez mensagens infinitas com um passo a mais. Um presente tem
 * fim, ou não é presente, é um preço mal cobrado.
 *
 * Dez mensagens custam ~R$ 0,10 uma vez na vida da conta, contra o R$ 1,00 de
 * valor que `INITIAL_COIN_BALANCE` já dá de graça no cadastro: é um
 * arredondamento numa exposição que já existe, e paga a única chance de
 * alguém descobrir por que valeria assinar.
 *
 * Não há contador na tela enquanto ele corre. O aviso aparece UMA vez, na
 * última mensagem, e é uma linha de agradecimento — não um diálogo, não um
 * bloqueio. Ver `docs/biblo-implementacao.md` §1.1.
 */
export const BIBLO_GIFT_MESSAGES = 10;

/**
 * Reason strings persisted in coin_transactions.reason. The server maps each
 * reason to its cost in COIN_COST_BY_REASON, clients never send an amount.
 */
export const CHARGE_REASONS = [
  "recording_minute",
  "deepening",
  "reprocess_summary",
  "reprocess_deepening",
  "youtube_import",
  "biblo_message",
] as const;
export type ChargeReason = (typeof CHARGE_REASONS)[number];

export const COIN_COST_BY_REASON: Record<ChargeReason, number> = {
  recording_minute: COIN_COSTS.recordingMinute,
  deepening: COIN_COSTS.deepening,
  reprocess_summary: COIN_COSTS.reprocessSummary,
  reprocess_deepening: COIN_COSTS.reprocessDeepening,
  youtube_import: COIN_COSTS.youtubeImport,
  biblo_message: COIN_COSTS.bibloMessage,
};

/**
 * Motivos que NÃO são mais emitidos, e continuam no ledger.
 *
 * `live_minute`, `audio_only_minute` e `transcript_minute` eram os três modos
 * de captura; `summary_from_transcript` era o resumo sob demanda de uma sessão
 * do modo transcrição. Nenhum cliente manda mais nenhum deles, mas
 * `coin_transactions` guarda anos de linhas com esses nomes, e o painel soma
 * por motivo. Ver `lib/coins/billable.ts`.
 */
export const LEGACY_CHARGE_REASONS = [
  "live_minute",
  "audio_only_minute",
  "transcript_minute",
  "summary_from_transcript",
] as const;

export function isChargeReason(value: unknown): value is ChargeReason {
  return typeof value === "string" && (CHARGE_REASONS as readonly string[]).includes(value);
}
