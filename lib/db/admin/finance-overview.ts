import "server-only";

import type {
  FinanceCategory,
  FinanceEntry,
  FinanceRecurring,
  FinanceSettings,
} from "@/lib/domain/finance";
import {
  buildFinanceOverview,
  type FinanceOverview,
  type MeasuredInputs,
} from "@/lib/finance/aggregate";
import { todayIso } from "@/lib/finance/recurrence";
import { getUsdToBrl, type UsdBrlRate } from "@/lib/fx/usd-brl";
import {
  getFinanceSettings,
  listCategories,
  listEntries,
  listRecurring,
  loadMeasuredInputs,
} from "./finance";

/**
 * A leitura completa do painel financeiro, montada uma vez por request.
 *
 * Existe para que as seis telas de `/admin/financeiro` não repitam a mesma
 * sequência de seis buscas mais a montagem do contexto de câmbio — e, mais
 * importante, para que nenhuma delas seja tentada a calcular "só este número
 * aqui" por conta própria. Tudo que qualquer tela mostra sai do
 * `FinanceOverview` devolvido daqui, e a aritmética inteira é a de
 * `lib/finance/aggregate.ts`.
 *
 * O câmbio vem de `getUsdToBrl()` — o MESMO de `/admin/usage`, com o mesmo
 * fallback manual em cookie. Uma segunda fonte de cotação faria a mesma
 * despesa em dólar valer coisas diferentes em duas telas do mesmo painel.
 */

export type FinanceSnapshot = {
  overview: FinanceOverview;
  entries: FinanceEntry[];
  recurring: FinanceRecurring[];
  categories: FinanceCategory[];
  settings: FinanceSettings;
  measured: MeasuredInputs;
  usdBrl: number | null;
  /** De onde veio a cotação, para a tela poder dizer. */
  fxSource: UsdBrlRate["source"] | null;
  today: string;
};

export async function loadFinanceSnapshot(monthsBack = 11): Promise<FinanceSnapshot> {
  const rate = await getUsdToBrl();
  const usdBrl = rate?.rate ?? null;

  const [entries, recurring, categories, settings, measured] = await Promise.all([
    listEntries(),
    listRecurring(),
    listCategories(),
    getFinanceSettings(),
    // +1 porque a série cobre `monthsBack` meses ANTERIORES mais o corrente.
    loadMeasuredInputs(usdBrl, monthsBack + 1),
  ]);

  const today = todayIso();

  const overview = buildFinanceOverview({
    entries,
    recurring,
    categories,
    measured,
    fx: { usdBrl },
    taxBps: settings.taxBps,
    cashBalanceCents: settings.cashBalanceCents,
    today,
    monthsBack,
  });

  return {
    overview,
    entries,
    recurring,
    categories,
    settings,
    measured,
    usdBrl,
    fxSource: rate?.source ?? null,
    today,
  };
}
