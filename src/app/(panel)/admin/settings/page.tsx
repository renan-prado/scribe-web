import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminTabs } from "@/features/admin/components/AdminTabs";
import { FeaturesManager } from "@/features/admin/components/FeaturesManager";
import { CategoriesManager } from "@/features/admin/components/finance/CategoriesManager";
import { FinanceNotices } from "@/features/admin/components/finance/FinanceNotices";
import { FinanceSettingsForm } from "@/features/admin/components/finance/FinanceSettingsForm";
import { getFinanceSettings, listCategories } from "@/features/admin/server/db/finance";
import { listFeatureOverrides, listFeatureSwitches } from "@/lib/db/feature-flags";
import { FEATURE_LIST } from "@/lib/entitlements/features";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

/**
 * Tudo o que o painel GIRA, num lugar só.
 *
 * Eram duas telas em dois cantos do menu, "Funcionalidades" no grupo do
 * produto e "Configurações financeiras" no do dinheiro, e as duas faziam a
 * mesma coisa: editar parâmetro que muda sem deploy. Quem procurava "onde eu
 * ligo/desligo isso" tinha de adivinhar por qual das duas começar.
 *
 * A régua da moeda NÃO veio para cá, e isso é deliberado: ela é uma simulação
 * lida ao lado do custo medido, e separá-la da margem que ela move faria o
 * número da outra tela parecer um fato. Ela continua na aba de preços de
 * /admin/costs. O câmbio manual, pela mesma razão, continua no selo que
 * mostra a cotação em uso.
 *
 * Cada aba busca só o que precisa: a de produto não toca em finanças, e a
 * financeira não carrega o snapshot de doze meses — ela não mostra total
 * nenhum, e puxar os eventos de LLM para desenhar dois formulários seria
 * gastar quatro consultas grandes por visita sem nada em troca.
 */

const TABS = ["product", "finance"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  product: "Funcionalidades",
  finance: "Financeiro",
};

const TAB_SUBTITLES: Record<Tab, string> = {
  product: "Quais funcionalidades cada plano libera, o kill switch e as exceções por pessoa.",
  finance: "O vocabulário das categorias e os parâmetros que o painel usa para calcular.",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "product";

  const [features, finance] = await Promise.all([
    tab === "product"
      ? Promise.all([listFeatureSwitches().catch(() => []), listFeatureOverrides().catch(() => [])])
      : Promise.resolve(null),
    tab === "finance"
      ? Promise.all([getFinanceSettings(), listCategories()])
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Configurações" subtitle={TAB_SUBTITLES[tab]} />

      <AdminTabs
        tabs={TABS.map((key) => ({
          href: key === "product" ? "/admin/settings" : `/admin/settings?tab=${key}`,
          label: TAB_LABELS[key],
          active: key === tab,
        }))}
      />

      {/* A matriz `funcionalidade × plano` é LEITURA, e vem primeiro: ela é o
          retrato de `lib/entitlements/features.ts`, e é assim que a tela diz
          "o lugar de liberar o estudo para outro plano não é aqui, é um
          commit". O que se edita abaixo dela são as duas exceções de runtime:
          desligar para todo mundo (incidente) e abrir ou fechar para uma
          pessoa. */}
      {features ? (
        <FeaturesManager features={FEATURE_LIST} switches={features[0]} overrides={features[1]} />
      ) : null}

      {finance ? (
        <>
          <FinanceSettingsForm settings={finance[0]} />

          <FinanceNotices
            tone="info"
            warnings={[
              "O câmbio do histórico e das dívidas continua vindo do selo de cotação em Custos; este aqui é só o das projeções, e existe para uma projeção de 12 meses não mudar de resultado porque o dólar oscilou.",
            ]}
          />

          {/* Categoria não se APAGA, arquiva-se: sem categoria um custo é
              tratado como variável, e apagar "Infraestrutura" faria o custo
              fixo de todo o histórico despencar sem nada indicando por quê. */}
          <CategoriesManager categories={finance[1]} />
        </>
      ) : null}
    </div>
  );
}
