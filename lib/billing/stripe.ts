import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env/server";

/**
 * Cliente Stripe compartilhado.
 *
 * Devolve `null` quando `STRIPE_SECRET_KEY` não está no ambiente, em vez de
 * lançar no import: um deploy sem Stripe configurado precisa continuar
 * gravando e resumindo normalmente — só as rotas de cobrança respondem 503.
 *
 * `apiVersion` fica de fora de propósito: o SDK já fixa a versão com a qual
 * seus tipos foram gerados (ver node_modules/stripe/VERSION). Cravar uma
 * string aqui só cria a chance de os tipos e o wire format divergirem numa
 * atualização de pacote.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = serverEnv.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      // O SDK já reenvia com backoff em erros de rede/429.
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: "scriba-web" },
    });
  }
  return cached;
}

/** True quando dá para vender: chave secreta + segredo de webhook presentes. */
export function isBillingConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_WEBHOOK_SECRET);
}

/** Base absoluta das URLs de retorno do Checkout. */
export function appUrl(path: string): string {
  const base = (serverEnv.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Extrai o Price ID de uma linha de fatura/checkout independentemente de o
 * campo ter vindo expandido (objeto) ou como string. As duas formas aparecem
 * conforme o evento e o nível de expansão pedido.
 */
export function priceIdOf(price: string | { id?: string } | null | undefined): string | null {
  if (!price) return null;
  if (typeof price === "string") return price;
  return price.id ?? null;
}

/** Idem para o campo `customer`, que vem string ou objeto conforme o evento. */
export function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

/**
 * Fim do período atual de uma assinatura. A partir da API 2025-03-31 (Basil)
 * o campo saiu do topo do objeto Subscription e passou a viver em cada item;
 * pegamos o MAIOR entre os itens, que é quando o acesso de fato expira.
 */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (!ends || ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000);
}
