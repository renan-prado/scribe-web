/**
 * Catálogo de planos, parte CLIENT-SAFE.
 *
 * Aqui mora só o que a UI precisa desenhar: nome, quantas moedas o plano dá,
 * quanto custa (em centavos, para formatar) e o texto de venda.
 *
 * ⚠️ NADA daqui é usado para cobrar nem para creditar.
 *   - O valor cobrado vem do Price object no Stripe (o `priceCents` abaixo é
 *     legenda de tela; se divergir, quem manda é o Stripe).
 *   - As moedas creditadas vêm de `lib/billing/catalog.ts` (server-only),
 *     resolvidas a partir do price ID que o Stripe confirmou como pago.
 * Editar este arquivo muda o que o usuário LÊ, nunca o que ele PAGA nem o que
 * ele RECEBE. Essa separação é proposital: é o que garante que um usuário
 * mexendo no bundle do front não consiga inventar crédito.
 *
 * O único dado que o cliente envia ao servidor é a CHAVE do plano/pacote
 * ("pessoal", "estudioso", "topup500") e, no pacote avulso, uma quantidade
 * inteira. Preço e moedas o servidor resolve sozinho.
 */

export const PLAN_KEYS = ["free", "pessoal", "estudioso"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

/** Planos pagos (os que viram uma assinatura no Stripe). */
export const PAID_PLAN_KEYS = ["pessoal", "estudioso"] as const;
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return typeof value === "string" && (PAID_PLAN_KEYS as readonly string[]).includes(value);
}

export type PlanDisplay = {
  key: PlanKey;
  name: string;
  /** Moedas creditadas a cada fatura paga. Rollover: somam ao saldo. */
  coins: number;
  /** Centavos de BRL. Apenas legenda, a cobrança é a do Price no Stripe. */
  priceCents: number;
  tagline: string;
};

/**
 * Os dois números de cada plano, fora do `PLANS` para o objeto poder ler os
 * dois enquanto nasce.
 */
const COINS = { free: 50, pessoal: 1000, estudioso: 2500 } as const;
const PRICE_CENTS = { free: 0, pessoal: 1990, estudioso: 4490 } as const;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

/** Formata milhares como "1.000", usado nos números de crédito. */
const NUM = new Intl.NumberFormat("pt-BR");
export function formatCoins(n: number): string {
  return NUM.format(n);
}

/**
 * Nome, preço, franquia e a frase de cada plano.
 *
 * **O que cada um ENTREGA não mora aqui: mora em `plan-features.ts`**, numa
 * lista só, lida pelos cards da landing e pelo diálogo de compra. As duas telas
 * já tiveram cada uma a sua, e só uma das duas era corrigida quando o produto
 * mudava: foi assim que "Estudo aprofundado de cada sessão" sobreviveu no
 * diálogo meses depois de o estudo sair da interface.
 *
 * A `tagline` fica, porque ela não é uma promessa de funcionalidade: é para
 * QUEM o plano é, e o `/profile` a usa sozinha, sem lista nenhuma ao lado.
 */
export const PLANS: Record<PlanKey, PlanDisplay> = {
  free: {
    key: "free",
    name: "Gratuito",
    coins: COINS.free,
    priceCents: PRICE_CENTS.free,
    tagline: "Ideal para conhecer o Scriba",
  },
  pessoal: {
    key: "pessoal",
    name: "Pessoal",
    coins: COINS.pessoal,
    priceCents: PRICE_CENTS.pessoal,
    tagline: "Ideial para devocionais e estudos pontuais",
  },
  estudioso: {
    key: "estudioso",
    name: "Estudioso",
    coins: COINS.estudioso,
    priceCents: PRICE_CENTS.estudioso,
    tagline: "Ideal para pregadores, professores e líderes",
  },
};

/** Ordem de exibição e de comparação (índice maior = plano mais alto). */
export const PLAN_ORDER: PlanKey[] = ["free", "pessoal", "estudioso"];

/** True quando `target` é um degrau acima de `current`. */
export function isUpgradeFrom(current: PlanKey, target: PlanKey): boolean {
  return PLAN_ORDER.indexOf(target) > PLAN_ORDER.indexOf(current);
}

/** Pacote avulso de créditos. Comprável em qualquer quantidade (1..MAX). */
export const TOPUP = {
  key: "topup500" as const,
  name: "Pacote de créditos",
  coins: 500,
  priceCents: 1000,
} as const;

export type TopupKey = typeof TOPUP.key;

/**
 * Teto de unidades por compra avulsa. Existe por dois motivos: evita um erro
 * de digitação virar uma cobrança de milhares de reais, e limita o estrago de
 * um cartão roubado numa única sessão de checkout. O servidor reaplica este
 * clamp, o valor aqui é só para a UI não oferecer o que será rejeitado.
 */
export const TOPUP_MAX_QUANTITY = 20;

/**
 * Status de assinatura em que o plano ainda vale. `past_due` entra de
 * propósito: o Stripe ainda está tentando cobrar e o usuário não deve perder
 * acesso no primeiro retry falho.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

export function isActiveStatus(status: string | null | undefined): boolean {
  return (
    typeof status === "string" &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  );
}

/** Resposta de GET /api/billing/summary. */
export type BillingSummary = {
  plan: PlanKey;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  balance: number;
  /** False quando o servidor está sem Stripe configurado, a UI esconde as
   * opções de compra em vez de oferecer botões que vão dar 503. */
  configured: boolean;
  /**
   * O ciclo de crédito, quando esta conta já recebeu uma franquia de plano.
   * `null` = nunca recebeu (conta gratuita, ou primeira fatura ainda não caiu),
   * e aí a tela mostra o saldo ABSOLUTO, que é a informação certa para quem não
   * tem renovação marcada. Ver `docs/creditos-na-tela.md`.
   *
   * O par vem do LEDGER, não do Stripe: `lib/db/coins.ts#getCycleUsage` explica
   * por quê, e a razão curta é que `past_due` continua ativo no produto, então
   * o período do Stripe vira sem que a recarga aconteça.
   */
  cycle: { grant: number; spent: number; since: string } | null;
};
