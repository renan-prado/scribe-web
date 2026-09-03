/**
 * Catálogo de planos — parte CLIENT-SAFE.
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
  /** Centavos de BRL. Apenas legenda — a cobrança é a do Price no Stripe. */
  priceCents: number;
  tagline: string;
  highlights: string[];
};

export const PLANS: Record<PlanKey, PlanDisplay> = {
  free: {
    key: "free",
    name: "Gratuito",
    coins: 50,
    priceCents: 0,
    tagline: "Para conhecer o Scriba",
    highlights: ["50 créditos de boas-vindas", "Todos os modos de gravação", "Sem cartão"],
  },
  pessoal: {
    key: "pessoal",
    name: "Pessoal",
    coins: 1000,
    priceCents: 1990,
    tagline: "Para acompanhar os cultos da semana",
    highlights: [
      "1.000 créditos por mês",
      "Créditos acumulam de um mês para o outro",
      "Cancele quando quiser",
    ],
  },
  estudioso: {
    key: "estudioso",
    name: "Estudioso",
    coins: 2500,
    priceCents: 4490,
    tagline: "Para quem estuda a sério, toda semana",
    highlights: [
      "2.500 créditos por mês",
      // O que este plano DESTRAVA, e não só quanto ele dá. A regra em si está
      // em `lib/entitlements/features.ts` — esta linha é a legenda dela, e as
      // duas precisam andar juntas: prometer aqui o que o catálogo não libera
      // é promessa quebrada depois do pagamento, como já foi com os créditos.
      "Estudo aprofundado de cada sessão",
      "Créditos acumulam de um mês para o outro",
      "Cancele quando quiser",
    ],
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
 * clamp — o valor aqui é só para a UI não oferecer o que será rejeitado.
 */
export const TOPUP_MAX_QUANTITY = 20;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

/** Formata milhares como "1.000" — usado nos números de crédito. */
const NUM = new Intl.NumberFormat("pt-BR");
export function formatCoins(n: number): string {
  return NUM.format(n);
}

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
  /** False quando o servidor está sem Stripe configurado — a UI esconde as
   * opções de compra em vez de oferecer botões que vão dar 503. */
  configured: boolean;
};
