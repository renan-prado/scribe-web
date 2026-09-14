import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: o Stripe devolve o usuário em `/v2/retorno`.
 *
 * As URLs novas de checkout já apontam para lá (ver `/api/billing/checkout`),
 * mas uma sessão de Checkout ABERTA quando este deploy subiu ainda carrega a
 * URL antiga gravada do lado do Stripe. Sem esta rota, quem estava pagando no
 * momento do deploy voltaria num 404 depois de ter sido cobrado.
 *
 * Os três parâmetros atravessam porque é deles que a tela vive: `cs` é o que
 * permite reconciliar um pagamento cujo webhook não chegou.
 */
export default async function BillingReturnRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tipo?: string; cs?: string }>;
}) {
  const { status, tipo, cs } = await searchParams;
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (tipo) query.set("tipo", tipo);
  if (cs) query.set("cs", cs);
  const qs = query.toString();
  permanentRedirect(qs ? `/v2/retorno?${qs}` : "/v2/retorno");
}
