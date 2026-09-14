import { permanentRedirect } from "next/navigation";

/**
 * Rota LEGADA: a tela de assinar mora em `/v2/assinar`.
 *
 * O `?plan=` ATRAVESSA o redirect, e tem de atravessar: é ele que carrega a
 * escolha feita na landing page, e um redirect que o descartasse mandaria a
 * pessoa para um checkout sem plano nenhum. `permanentRedirect` não repassa
 * query sozinho, por isso ela é lida e recolada aqui.
 */
export default async function AssinarRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  permanentRedirect(plan ? `/v2/assinar?plan=${encodeURIComponent(plan)}` : "/v2/assinar");
}
