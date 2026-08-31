import "server-only";
import type Stripe from "stripe";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/db/billing";

/**
 * Resolve (ou cria) o Customer do Stripe de um usuário.
 *
 * O id do customer NUNCA vem do request — é lido do profiles do usuário
 * autenticado ou criado na hora. É o que garante que uma sessão de checkout
 * sempre cobre e credite a MESMA conta que a iniciou: mesmo que alguém forje
 * o corpo do POST, o customer usado é o dele.
 *
 * `metadata.userId` no customer é redundância proposital: se um dia o vínculo
 * em profiles se perder, o webhook ainda consegue reencontrar o dono.
 */
export async function getOrCreateCustomer(args: {
  stripe: Stripe;
  userId: string;
  email: string | null;
  name: string | null;
}): Promise<string> {
  const existing = await getStripeCustomerId(args.userId);
  if (existing) {
    // Confere que o customer ainda existe do lado do Stripe (uma conta de
    // teste apagada deixaria um id órfão que faz o checkout falhar).
    try {
      const customer = await args.stripe.customers.retrieve(existing);
      if (!("deleted" in customer) || !customer.deleted) return existing;
    } catch {
      // cai para a criação abaixo
    }
  }

  const created = await args.stripe.customers.create({
    email: args.email ?? undefined,
    name: args.name ?? undefined,
    metadata: { userId: args.userId },
  });
  await setStripeCustomerId(args.userId, created.id);
  return created.id;
}
