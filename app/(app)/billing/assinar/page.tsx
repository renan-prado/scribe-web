import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StartSubscription } from "@/features/billing/components/StartSubscription";
import { isActiveStatus, isPaidPlanKey } from "@/lib/billing/plans";
import { getOwnSubscription } from "@/lib/db/billing";

export const metadata: Metadata = { title: "Assinar" };

type PageProps = {
  searchParams: Promise<{ plan?: string }>;
};

/**
 * Destino da intenção "quero este plano" vinda da landing page.
 *
 * Fica dentro de `(app)`, então o proxy já exige login: um visitante é mandado
 * para `/sign-in?next=/billing/assinar?plan=X` e volta para cá depois do
 * Google, com a escolha intacta.
 *
 * Dois desvios antes de gastar uma chamada no Stripe:
 *  - plano inválido na URL → manda para o /profile, onde ele escolhe de novo;
 *  - já assinante → não faz sentido abrir um checkout que a rota recusaria
 *    com `already_subscribed`; trocar de plano é trabalho do portal.
 */
export default async function AssinarPage({ searchParams }: PageProps) {
  const { plan } = await searchParams;
  if (!isPaidPlanKey(plan)) redirect("/profile");

  const current = await getOwnSubscription().catch(() => null);
  if (current?.stripeSubscriptionId && isActiveStatus(current.status)) {
    redirect("/profile");
  }

  return <StartSubscription plan={plan} />;
}
