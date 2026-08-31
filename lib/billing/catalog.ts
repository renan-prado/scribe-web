import "server-only";
import {
  type PaidPlanKey,
  PLANS,
  TOPUP,
  TOPUP_MAX_QUANTITY,
  type TopupKey,
} from "@/lib/billing/plans";
import { serverEnv } from "@/lib/env/server";

/**
 * Catálogo SERVER-ONLY: a ponte entre uma chave de plano/pacote e o Price ID
 * do Stripe, e — no sentido inverso — entre um Price ID pago e quantas moedas
 * ele vale.
 *
 * O sentido inverso (`entitlementForPrice`) é o coração da segurança do
 * crédito. O webhook NUNCA lê "quantas moedas" do metadata da sessão de
 * checkout (metadata é escrito por nós, mas nada impede um evento forjado…
 * exceto a assinatura — e mesmo assim preferimos não depender disso). Ele
 * pega o Price ID que o Stripe confirmou como PAGO, procura aqui, e credita
 * o que ESTE arquivo diz. Se o Price não estiver no catálogo, nada é
 * creditado e o evento é logado como suspeito.
 *
 * Consequência prática: criar um Price novo no dashboard do Stripe não gera
 * crédito nenhum até alguém apontar a env var correspondente para ele. É o
 * comportamento que queremos — um Price desconhecido é uma anomalia, não uma
 * oportunidade.
 */

export type Entitlement =
  | { kind: "subscription"; plan: PaidPlanKey; coinsPerUnit: number }
  | { kind: "topup"; pack: TopupKey; coinsPerUnit: number };

/** Price ID de cada plano pago, ou null quando a env var não foi configurada. */
export function priceIdForPlan(plan: PaidPlanKey): string | null {
  if (plan === "pessoal") return serverEnv.STRIPE_PRICE_PESSOAL ?? null;
  if (plan === "estudioso") return serverEnv.STRIPE_PRICE_ESTUDIOSO ?? null;
  return null;
}

/** Price ID do pacote avulso de 500 créditos. */
export function priceIdForTopup(): string | null {
  return serverEnv.STRIPE_PRICE_TOPUP_500 ?? null;
}

/**
 * Mapa reverso Price ID → direito adquirido. Construído a cada chamada em vez
 * de no módulo porque as env vars podem ser injetadas depois do primeiro
 * import em alguns runtimes — e o custo é irrelevante (3 entradas).
 */
function entitlementIndex(): Map<string, Entitlement> {
  const index = new Map<string, Entitlement>();

  const pessoal = priceIdForPlan("pessoal");
  if (pessoal) {
    index.set(pessoal, {
      kind: "subscription",
      plan: "pessoal",
      coinsPerUnit: PLANS.pessoal.coins,
    });
  }

  const estudioso = priceIdForPlan("estudioso");
  if (estudioso) {
    index.set(estudioso, {
      kind: "subscription",
      plan: "estudioso",
      coinsPerUnit: PLANS.estudioso.coins,
    });
  }

  const topup = priceIdForTopup();
  if (topup) {
    index.set(topup, { kind: "topup", pack: TOPUP.key, coinsPerUnit: TOPUP.coins });
  }

  return index;
}

/**
 * Resolve um Price ID pago para o direito que ele confere. `null` significa
 * "não reconheço este preço" — o chamador NÃO deve creditar nada.
 */
export function entitlementForPrice(priceId: string | null | undefined): Entitlement | null {
  if (!priceId) return null;
  return entitlementIndex().get(priceId) ?? null;
}

/**
 * Normaliza a quantidade de pacotes avulsos que o cliente pediu. É o único
 * número que aceitamos do front no fluxo de compra, então é clampeado aqui e
 * conferido de novo contra a quantidade que o Stripe reporta na linha paga.
 */
export function clampTopupQuantity(raw: unknown): number {
  const n = typeof raw === "number" ? Math.floor(raw) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(TOPUP_MAX_QUANTITY, Math.max(1, n));
}
