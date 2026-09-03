import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FeaturesManager } from "@/features/admin/components/FeaturesManager";
import { listFeatureOverrides, listFeatureSwitches } from "@/lib/db/feature-flags";
import { FEATURE_LIST } from "@/lib/entitlements/features";

export const metadata: Metadata = { title: "Funcionalidades" };
export const dynamic = "force-dynamic";

/**
 * A matriz `funcionalidade × plano` é LEITURA. Ela é desenhada a partir de
 * `lib/entitlements/features.ts`, e mudá-la é um deploy — ver o comentário no
 * topo daquele arquivo e o da migração 0032.
 *
 * O que esta tela edita são as duas exceções de runtime: desligar uma feature
 * para todo mundo (incidente) e abrir ou fechar para uma pessoa (beta tester,
 * abuso).
 */
export default async function AdminFeaturesPage() {
  const [switches, overrides] = await Promise.all([
    listFeatureSwitches().catch(() => []),
    listFeatureOverrides().catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Funcionalidades"
        subtitle="Quais funcionalidades cada plano libera, o kill switch e as exceções por pessoa."
      />
      <FeaturesManager features={FEATURE_LIST} switches={switches} overrides={overrides} />
    </div>
  );
}
