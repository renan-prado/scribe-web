/**
 * A economia do programa de parceiros, em um lugar só.
 *
 * Client-safe de propósito: o simulador do admin recalcula a cada tecla
 * digitada no campo de taxa, e o painel do parceiro mostra os mesmos números.
 * Três cópias da mesma conta é como se descobre tarde que uma delas estava
 * errada — e, tratando-se de quanto pagamos a alguém, "tarde" significa
 * depois de o PIX ter saído.
 *
 * Nada aqui é segredo: são preços públicos, um percentual que o parceiro
 * conhece e um custo que o admin mede. O que NÃO mora aqui é qualquer decisão
 * de crédito — isso é `lib/billing/*`, server-only, e continua sendo.
 *
 * A memória de cálculo, com as tabelas e o porquê dos 30%, está em
 * docs/parceiros.md.
 */

/**
 * Carência antes de a comissão ficar disponível para saque.
 *
 * Trinta dias é o tempo em que um pagamento ainda pode ser contestado sem que
 * a gente saiba. Pagar antes disso é assumir o risco de mandar dinheiro por
 * uma venda que vai voltar atrás — e, ao contrário do estorno de moedas, um
 * PIX enviado não se desfaz.
 */
export const COMMISSION_HOLD_DAYS = 30;

/**
 * Mínimo para um pagamento sair. Abaixo disso o saldo acumula para o mês
 * seguinte, nunca expira, e é pago integralmente se o parceiro deixar o
 * programa.
 *
 * Existe porque um PIX manual de R$ 4 custa mais em trabalho do que vale — e
 * o número não é neutro: quanto maior o mínimo, mais tempo um parceiro
 * pequeno passa sem receber nada, o que faz o programa PARECER que não paga.
 * Foi essa tensão, e não a margem, que decidiu a taxa padrão de 30%.
 */
export const PAYOUT_MINIMUM_CENTS = 5000;

/** Taxa de comissão padrão, em basis points (3000 = 30,00%). */
export const DEFAULT_COMMISSION_BPS = 3000;

/** Bônus de moedas padrão para quem se cadastra por indicação. */
export const DEFAULT_SIGNUP_BONUS_COINS = 150;

/**
 * Mesada mensal padrão do PRÓPRIO parceiro — ~100 min de gravação com live.
 *
 * Mora aqui, e não em `allowance.ts`, porque o cadastro do admin é um client
 * component: importar a constante de um módulo `server-only` arrasta o cliente
 * do Supabase com service-role para o bundle do navegador, e o build recusa —
 * corretamente. A regra vale para toda constante desta família: número que a
 * tela precisa ler fica no arquivo client-safe; quem CREDITA fica no
 * server-only.
 */
export const DEFAULT_PARTNER_MONTHLY_COINS = 500;

/**
 * Taxa do Stripe para cartão nacional. Sai da nossa margem — o parceiro é
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
   * Custo do bônus AMORTIZADO por assinante conquistado. O bônus é pago a
   * todo indicado que se cadastra, inclusive aos que nunca assinam — então
   * quanto pior a conversão, mais caro ele fica por assinante.
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
 * 1. **O bônus costuma custar mais que a comissão.** Ele é pago a todo
 *    cadastro, e só uma fração vira assinante. A 5% de conversão, 150 moedas
 *    por cadastro viram um custo por assinante maior que 30% da mensalidade.
 *    Quem olha só o percentual do parceiro está olhando a variável errada.
 *
 * 2. **O mês 1 não é o negócio inteiro.** Comissão e bônus são pagos UMA vez;
 *    a margem se repete todo mês enquanto a pessoa ficar. Por isso um mês 1
 *    negativo não é necessariamente ruim — `paybackDays` diz em quanto tempo
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
  const rawBonusCost = coinCost(Math.round(input.bonusCoins * input.bonusUsageRate));
  const bonusCost = conversion > 0 ? Math.round(rawBonusCost / conversion) : rawBonusCost;

  const recurring = input.priceCents - fee - planCoinsCost;
  const month1 = recurring - partner - bonusCost;

  const paybackDays = month1 < 0 && recurring > 0 ? Math.ceil((-month1 / recurring) * 30) : 0;

  const conversionsToPayout = partner > 0 ? Math.ceil(PAYOUT_MINIMUM_CENTS / partner) : 0;

  // "thin" não é um alerta de prejuízo — é o aviso de que a folga ficou
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
