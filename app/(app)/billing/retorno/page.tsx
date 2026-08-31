import type { Metadata } from "next";
import { CheckoutReturn } from "@/features/billing/components/CheckoutReturn";

export const metadata: Metadata = { title: "Pagamento" };

type PageProps = {
  searchParams: Promise<{ status?: string; tipo?: string; cs?: string }>;
};

/**
 * Para onde o Stripe devolve o usuário depois do Checkout.
 *
 * Nada nesta URL é tratado como fato. `?status=sucesso` é só o que o Stripe
 * devolve — digitar isso à mão não produz um crédito sequer. O `?cs=` também
 * não autoriza nada: é um endereço, e POST /api/billing/reconcile só age
 * depois de buscar a sessão na API do Stripe e conferir que ela pertence ao
 * usuário autenticado e foi de fato paga.
 *
 * A reconciliação existe porque o webhook pode não chegar (deploy no meio do
 * pagamento, endpoint fora do ar, listener parado em dev). Sem ela, esses
 * casos viram dinheiro cobrado e crédito não entregue, em silêncio.
 *
 * Como o checkout abre numa aba nova (para não matar uma gravação em curso),
 * o caminho normal é: confirmação → o usuário fecha a aba → a aba original
 * ressincroniza o saldo no `focus`.
 */
export default async function BillingReturnPage({ searchParams }: PageProps) {
  const { status, tipo, cs } = await searchParams;
  return (
    <CheckoutReturn
      canceled={status === "cancelado"}
      kind={tipo === "subscription" ? "subscription" : "topup"}
      sessionId={typeof cs === "string" && cs.startsWith("cs_") ? cs : null}
    />
  );
}
