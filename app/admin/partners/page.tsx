import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { PartnersManager } from "@/features/admin/components/PartnersManager";
import { appUrl } from "@/lib/billing/stripe";
import { listPartners } from "@/lib/db/admin/partners";
import { loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { getUsdToBrl } from "@/lib/fx/usd-brl";

export const metadata: Metadata = { title: "Parceiros" };
export const dynamic = "force-dynamic";

/**
 * Cadastro, métricas e pagamento dos parceiros divulgadores.
 *
 * O custo por moeda é MEDIDO aqui e passado ao simulador de comissão: ele muda
 * com o câmbio e com o preço do modelo, e uma simulação sobre número velho
 * levaria a decidir uma taxa com base numa margem que não existe mais.
 */
export default async function AdminPartnersPage() {
  const [partners, usage, rate] = await Promise.all([
    listPartners(),
    loadAdminUsageSummary(),
    getUsdToBrl(),
  ]);

  const costPerThousandCoinsCents =
    rate && usage.overallCostPerCoinUsd
      ? Math.round(usage.overallCostPerCoinUsd * 1000 * rate.rate * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Parceiros"
        subtitle="Divulgadores convidados, seus números e o que há a pagar."
      />
      <PartnersManager
        initialPartners={partners}
        costPerThousandCoinsCents={costPerThousandCoinsCents}
        linkBase={appUrl("/r")}
      />
    </div>
  );
}
