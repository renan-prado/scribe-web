/**
 * A economia do programa de parceiros, em um lugar só.
 *
 * Client-safe de propósito: o simulador do admin recalcula a cada tecla
 * digitada no campo de taxa, e o painel do parceiro mostra os mesmos números.
 * Três cópias da mesma conta é como se descobre tarde que uma delas estava
 * errada, e, tratando-se de quanto pagamos a alguém, "tarde" significa
 * depois de o PIX ter saído.
 *
 * Nada aqui é segredo: são preços públicos, um percentual que o parceiro
 * conhece e um custo que o admin mede. O que NÃO mora aqui é qualquer decisão
 * de crédito, isso é `lib/billing/*`, server-only, e continua sendo.
 *
 * A memória de cálculo, com as tabelas e o porquê dos 30%, está em
 * docs/parceiros.md.
 */

/**
 * Carência antes de a comissão ficar disponível para saque.
 *
 * Trinta dias é o tempo em que um pagamento ainda pode ser contestado sem que
 * a gente saiba. Pagar antes disso é assumir o risco de mandar dinheiro por
 * uma venda que vai voltar atrás, e, ao contrário do estorno de moedas, um
 * PIX enviado não se desfaz.
 */
export const COMMISSION_HOLD_DAYS = 30;

/**
 * Mínimo do pagamento de ROTINA. Abaixo disso o saldo acumula para o mês
 * seguinte, nunca expira, e é pago integralmente se o parceiro deixar o
 * programa.
 *
 * Existe porque um PIX manual de R$ 4 custa mais em trabalho do que vale, e
 * o número não é neutro: quanto maior o mínimo, mais tempo um parceiro
 * pequeno passa sem receber nada, o que faz o programa PARECER que não paga.
 * Foi essa tensão, e não a margem, que decidiu a taxa padrão de 30%.
 *
 * É POLÍTICA, NÃO TRAVA. O admin pode registrar um pagamento abaixo dele,
 * o diálogo avisa e segue. A própria frase acima ("é pago integralmente se o
 * parceiro deixar o programa") descreve um pagamento que quase sempre nasce
 * abaixo do mínimo; se o botão sumisse, a única saída seria mexer no banco à
 * mão. Não transforme esta constante em condição de bloqueio.
 */
export const PAYOUT_MINIMUM_CENTS = 5000;

/**
 * O dia do mês em que o pagamento de rotina sai.
 *
 * **Uma data, e não "uma vez por mês".** A frase antiga era verdadeira e
 * inútil: quem está esperando dinheiro quer saber QUANDO, e "mensalmente" não
 * responde isso. Uma data fixa transforma a espera em contagem, e é a
 * diferença entre um programa que parece organizado e um que parece depender
 * de alguém lembrar.
 *
 * Como todo mês tem um dia 30 menos fevereiro, ver `payoutDayForMonth`.
 */
export const PAYOUT_DAY_OF_MONTH = 30;

/**
 * O dia do pagamento no mês pedido, já resolvido para fevereiro.
 *
 * Fevereiro não tem dia 30, e a alternativa, empurrar para 1º de março,
 * atrasaria o único pagamento do ano que cai num mês curto. Antecipar para o
 * último dia do mês mantém a promessa ("todo mês, no fim") e ainda respeita o
 * ano bissexto sozinho: `new Date(ano, mes + 1, 0)` é o último dia do mês, 28
 * ou 29 conforme o ano.
 *
 * `month` é 0-based, como no `Date` do JS, para não existirem duas convenções
 * de mês no mesmo arquivo.
 */
export function payoutDayForMonth(year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(PAYOUT_DAY_OF_MONTH, lastDay);
}

/**
 * A frase do pagamento, escrita UMA vez e usada em toda tela que fala dele.
 *
 * Ela existe porque a regra já apareceu com três redações diferentes em três
 * telas ("mensalmente", "uma vez por mês", "no PIX do mês seguinte"), e três
 * redações da mesma regra é como uma delas fica para trás quando a regra muda.
 */
export const PAYOUT_SCHEDULE_LABEL = `todo dia ${PAYOUT_DAY_OF_MONTH} (ou no último dia do mês, em fevereiro)`;

/** Taxa de comissão padrão, em basis points (3000 = 30,00%). */
export const DEFAULT_COMMISSION_BPS = 3000;

/** Bônus de moedas padrão para quem se cadastra por indicação. */
export const DEFAULT_SIGNUP_BONUS_COINS = 150;

/**
 * Moedas que o PARCEIRO ganha por cada cadastro atribuído a ele, a resposta
 * para "não quero ficar na mão trazendo lead que não assina".
 *
 * **20, e já foi 50.** O valor antigo vinha por COERÊNCIA com o programa aberto
 * de indicação (`REFERRAL_SIGNUP_COINS`, também 50), sob o argumento de que é
 * o mesmo fato econômico, uma conta nova entrou por causa de alguém. A
 * coerência era verdadeira e custava caro: o cadastro é o evento mais
 * frequente do programa, o único que não depende de ninguém assinar nada, e
 * cada um deles minta moeda que vira custo de inferência depois. O que separa
 * os dois programas é o que vem DEPOIS, e é justamente aí que eles deixam de
 * ser o mesmo caso: o parceiro leva 30% da primeira mensalidade EM DINHEIRO, o
 * amigo leva 200 moedas. Quem já recebe dinheiro não precisa da mesma moeda
 * que quem não recebe.
 *
 * Em 20 a recompensa continua existindo, que é o ponto dela ("não quero ficar
 * na mão trazendo lead que não assina"), sem disputar espaço com a comissão.
 *
 * Efeito na conta do programa, medido quando ela ainda valia 50, com 150
 * moedas de bônus ao indicado já somadas (200 mintadas por cadastro) e custo
 * de R$ 2,69 o milheiro: o mês 1 por assinante Pessoal caía de R$ 6,83 para
 * R$ 5,76 no cenário realista (5% de conversão, 40% de uso). No pessimista (3%
 * e 100%) ficava negativo em R$ 7,87 e se pagava em 15 dias do mês 2. Com 20
 * as duas pontas melhoram; a aritmética exata é a que
 * `simulatePartnerEconomics` mostra no cadastro antes de salvar.
 *
 * Espelha o DEFAULT de `partners.signup_reward_coins` (migração 0045, alterado
 * para 20 na 0052) e é editável por parceiro, como a taxa e o bônus. **A
 * migração mexeu só no padrão:** parceiro já cadastrado mantém o valor que
 * negociou, porque mudá-lo aqui alteraria em silêncio um combinado de quem já
 * está divulgando.
 *
 * ELAS ACUMULAM antes de virar saldo: `partners.user_id` nasce nulo, então no
 * momento do cadastro do indicado pode não haver conta para creditar. Ver
 * `flush_partner_signup_rewards`.
 */
export const DEFAULT_PARTNER_SIGNUP_REWARD_COINS = 20;

/**
 * Mesada mensal padrão do PRÓPRIO parceiro, ~100 min de gravação com live.
 *
 * Mora aqui, e não em `allowance.ts`, porque o cadastro do admin é um client
 * component: importar a constante de um módulo `server-only` arrasta o cliente
 * do Supabase com service-role para o bundle do navegador, e o build recusa,
 * corretamente. A regra vale para toda constante desta família: número que a
 * tela precisa ler fica no arquivo client-safe; quem CREDITA fica no
 * server-only.
 */
export const DEFAULT_PARTNER_MONTHLY_COINS = 500;

/**
 * Moedas de cortesia do PRÉ-PARCEIRO, quem chega por `/parceiros`, cria conta
 * sem compromisso nenhum e quer só ver se o produto faz sentido para o público
 * dele antes de topar divulgar.
 *
 * Mesmo valor da mesada, e não por acaso: é a mesma pergunta ("dá para eu usar
 * isto de verdade por um mês?"), feita antes de existir acordo. Quem é promovido
 * a parceiro passa a receber a mesada por cima disto.
 *
 * NÃO se soma ao bônus de indicação. Quem entrou pelo link de um parceiro ou de
 * um amigo já ganhou um brinde de boas-vindas, e `attach_partner_prospect`
 * recusa o segundo, ver migração 0050.
 */
export const PARTNER_PROSPECT_COINS = 500;

/**
 * Teto GLOBAL do brinde acima, em moedas, somado sobre todos os pré-parceiros
 * já creditados.
 *
 * **Ele é a única coisa entre esta funcionalidade e uma torneira aberta.**
 * `/parceiros` é página pública: qualquer pessoa com uma conta Google nova
 * passa por ela e pede as moedas, e não há um parceiro do outro lado com
 * `bonus_budget_coins` limitando nada. O custo de atacar isto é o custo de
 * criar contas Google, alto, mas não infinito.
 *
 * 50.000 moedas = 100 pré-parceiros ≈ R$ 135 ao custo medido atual. É a ordem
 * de grandeza de um teste do programa, não de um canal de aquisição: quando os
 * 100 primeiros entrarem, o número precisa ser revisto À MÃO, de propósito.
 * Estourado o teto, a pessoa ainda é registrada como pré-parceiro (queremos
 * saber quem se interessou), só não recebe moeda.
 *
 * O valor viaja como PARÂMETRO até a RPC, que é service_role-only, ele nunca
 * vem do navegador. Mudá-lo é editar esta linha e fazer deploy, sem migração.
 */
export const PARTNER_PROSPECT_BUDGET_COINS = 50_000;

/**
 * Taxa do Stripe para cartão nacional. Sai da nossa margem, o parceiro é
 * comissionado sobre o valor cheio da mensalidade, porque é o número que ele
 * consegue conferir sozinho a partir do preço público, e essa conferência é o
 * que torna o programa confiável para ele.
 */
export const STRIPE_PERCENT_FEE = 0.0399;
export const STRIPE_FIXED_FEE_CENTS = 39;

export function stripeFeeCents(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents * STRIPE_PERCENT_FEE) + STRIPE_FIXED_FEE_CENTS;
}

/** Comissão sobre um valor bruto. Espelha o cálculo gravado na migração. */
export function commissionCents(grossCents: number, rateBps: number): number {
  return Math.round((grossCents * rateBps) / 10_000);
}

export type SimulationInput = {
  /** Preço cheio da mensalidade, em centavos. */
  priceCents: number;
  /** Moedas que o plano credita por mês. */
  planCoins: number;
  /** Taxa do parceiro em basis points. */
  rateBps: number;
  /** Custo medido de 1.000 moedas, em centavos de BRL. Vem de `/admin`. */
  costPerThousandCoinsCents: number;
  /** Moedas dadas a cada indicado que se cadastra. */
  bonusCoins: number;
  /**
   * Moedas dadas AO PARCEIRO a cada cadastro (migração 0045). Amortiza como o
   * bônus, é pago por cadastro, e só uma fração deles vira assinante, mas
   * SEM a fração de uso: o parceiro é um usuário ativo por definição do
   * programa (é essa a razão de existir da mesada), então tratá-lo como se
   * gastasse 40% do que ganha subestimaria o custo justamente na conta que
   * existe para não subestimar nada.
   */
  rewardCoins: number;
  /** Conversão cadastro → assinante, 0..1. */
  conversionRate: number;
  /** Fração dos indicados que efetivamente gasta o bônus, 0..1. */
  bonusUsageRate: number;
};

export type Simulation = {
  /** Quanto o parceiro recebe por assinante conquistado. */
  partnerCents: number;
  /** Taxa do Stripe sobre a mensalidade. */
  stripeFeeCents: number;
  /** Custo das moedas do próprio plano. */
  planCoinsCostCents: number;
  /**
   * Custo AMORTIZADO por assinante conquistado das moedas pagas no CADASTRO,
   * o bônus ao indicado mais a recompensa ao parceiro. As duas são pagas a
   * todo cadastro, inclusive aos que nunca assinam, então quanto pior a
   * conversão, mais caras elas ficam por assinante.
   */
  bonusCostCents: number;
  /** Resultado do primeiro mês, já descontado tudo acima. */
  month1Cents: number;
  /** Margem recorrente do mês 2 em diante: sem comissão e sem bônus. */
  recurringCents: number;
  /** Dias do mês 2 necessários para cobrir um mês 1 negativo. 0 se positivo. */
  paybackDays: number;
  /** Conversões necessárias para o parceiro atingir o mínimo de saque. */
  conversionsToPayout: number;
  /** Faixa de leitura para a UI. */
  verdict: "healthy" | "thin" | "negative";
};

/**
 * A conta completa, por assinante conquistado.
 *
 * Duas armadilhas que ela existe para tornar visíveis:
 *
 * 1. **As moedas do cadastro costumam custar mais que a comissão.** Elas são
 *    pagas a todo cadastro, as do indicado E as do parceiro, e só uma
 *    fração vira assinante. A 5% de conversão, 200 moedas por cadastro viram
 *    um custo por assinante maior que 30% da mensalidade. Quem olha só o
 *    percentual do parceiro está olhando a variável errada.
 *
 * 2. **O mês 1 não é o negócio inteiro.** Comissão e bônus são pagos UMA vez;
 *    a margem se repete todo mês enquanto a pessoa ficar. Por isso um mês 1
 *    negativo não é necessariamente ruim, `paybackDays` diz em quanto tempo
 *    ele se resolve.
 */
export function simulatePartnerEconomics(input: SimulationInput): Simulation {
  const coinCost = (coins: number) => Math.round((coins * input.costPerThousandCoinsCents) / 1000);

  const partner = commissionCents(input.priceCents, input.rateBps);
  const fee = stripeFeeCents(input.priceCents);
  const planCoinsCost = coinCost(input.planCoins);

  // Divisão por zero quando a conversão é 0: sem assinante, não há por quem
  // amortizar. Devolvemos o custo bruto do bônus em vez de Infinity, para que
  // a UI mostre um número em vez de quebrar.
  const conversion = Math.max(0, Math.min(1, input.conversionRate));
  const signupCoins =
    Math.round(input.bonusCoins * input.bonusUsageRate) + Math.max(0, input.rewardCoins);
  const rawBonusCost = coinCost(signupCoins);
  const bonusCost = conversion > 0 ? Math.round(rawBonusCost / conversion) : rawBonusCost;

  const recurring = input.priceCents - fee - planCoinsCost;
  const month1 = recurring - partner - bonusCost;

  const paybackDays = month1 < 0 && recurring > 0 ? Math.ceil((-month1 / recurring) * 30) : 0;

  const conversionsToPayout = partner > 0 ? Math.ceil(PAYOUT_MINIMUM_CENTS / partner) : 0;

  // "thin" não é um alerta de prejuízo, é o aviso de que a folga ficou
  // pequena o bastante para uma variação de câmbio ou de preço de modelo
  // empurrar o mês 1 para o vermelho.
  const verdict: Simulation["verdict"] =
    month1 < 0 ? "negative" : month1 < recurring * 0.25 ? "thin" : "healthy";

  return {
    partnerCents: partner,
    stripeFeeCents: fee,
    planCoinsCostCents: planCoinsCost,
    bonusCostCents: bonusCost,
    month1Cents: month1,
    recurringCents: recurring,
    paybackDays,
    conversionsToPayout,
    verdict,
  };
}

/**
 * Premissas de conversão usadas quando não há dado real ainda.
 *
 * São CHUTES conservadores, e estão aqui nomeadas para que apareçam como
 * chutes na tela em vez de se disfarçarem de medição. Assim que o admin tiver
 * conversão medida por parceiro (Fase 4), o simulador deve preferir o número
 * real e manter estes só como fallback.
 */
export const ASSUMED_CONVERSION_RATE = 0.05;
export const ASSUMED_BONUS_USAGE_RATE = 0.4;
