import "server-only";
import { formatBrl, PLANS, TOPUP } from "@/lib/billing/plans";
import { BILLABLE_ACTION_BY_KEY, type BillableActionKey } from "@/lib/coins/billable";
import {
  COINS_PER_COST_UNIT,
  type CoinEconomicsSettings,
  computeActionEconomics,
  ledgerDivergesFromPrice,
} from "@/lib/coins/economics";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCoinEconomics } from "@/lib/coins/settings";
import { loadAdminMetrics } from "@/lib/db/admin/metrics";
import { type AdminUsageSummary, loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { type AdminInsightScope, INSIGHTS_WINDOW_DAYS } from "@/lib/domain/admin-insights";
import { getUsdToBrl, type UsdBrlRate } from "@/lib/fx/usd-brl";
import { stripeFeeCents } from "@/lib/partners/economics";

/**
 * O BRIEFING: os números que o analista de `/admin/insights` recebe.
 *
 * Três decisões governam este arquivo, e as três são sobre confiança:
 *
 * 1. **Nada é calculado aqui.** Margem sai de `computeActionEconomics`, funil e
 *    passivo saem de `loadAdminMetrics`, custo sai de `loadAdminUsageSummary`.
 *    Uma segunda aritmética de margem, escrita para "formatar melhor para o
 *    modelo", seria uma segunda definição do número — e o dia em que ela
 *    discordasse da tabela apareceria como um insight contradizendo a tela
 *    logo acima dele.
 *
 * 2. **Cada linha vem etiquetada [MEDIDO] ou [RÉGUA].** O prompt separa as
 *    duas com todo cuidado; se o briefing entregasse tudo achatado, a
 *    separação seria retórica. O custo é medição; o valor da moeda é um
 *    cookie que o admin girou e que não cobra nada de ninguém.
 *
 * 3. **É texto, não JSON.** JSON de agregado vira, na cabeça do modelo, uma
 *    tabela para transcrever de volta — e transcrição é exatamente o modo de
 *    falha do card. Texto rotulado, com a unidade colada no número, produz
 *    frase em vez de listagem.
 *
 * A janela é FIXA em `INSIGHTS_WINDOW_DAYS`, e não o filtro de período da
 * tela: ver a nota naquela constante.
 */

const INT = new Intl.NumberFormat("pt-BR");
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function money(brl: number | null): string {
  return brl == null ? "sem câmbio" : BRL.format(brl);
}

function pct(ratio: number | null): string {
  return ratio == null ? "—" : `${(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

function windowFrom(): string {
  return new Date(Date.now() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Os dois lados da régua, escritos uma vez e reusados nos três escopos. */
function rulerBlock(settings: CoinEconomicsSettings, rate: UsdBrlRate | null): string {
  return [
    "── A RÉGUA (simulação — o admin digitou; não cobra nada de ninguém) ──",
    `[RÉGUA] valor de venda da moeda: ${BRL.format(settings.pricePerThousandBrl)} por ${INT.format(COINS_PER_COST_UNIT)} moedas`,
    `[RÉGUA] margem alvo: ${settings.targetMarginPct}%`,
    `[MEDIDO] câmbio USD→BRL usado nesta conversão: ${rate ? rate.rate.toFixed(4) : "indisponível — os valores em real estão ausentes"}${rate?.source ? ` (${rate.source})` : ""}`,
    "",
    "Para referência de mercado (preços reais, no Stripe):",
    `[MEDIDO] pacote avulso: ${formatBrl(TOPUP.priceCents)} por ${INT.format(TOPUP.coins)} moedas`,
    `[MEDIDO] plano Pessoal: ${formatBrl(PLANS.pessoal.priceCents)}/mês, credita ${INT.format(PLANS.pessoal.coins)} moedas`,
    `[MEDIDO] plano Estudioso: ${formatBrl(PLANS.estudioso.priceCents)}/mês, credita ${INT.format(PLANS.estudioso.coins)} moedas`,
    `[MEDIDO] conta nova ganha ${INT.format(INITIAL_COIN_BALANCE)} moedas de boas-vindas`,
  ].join("\n");
}

/** O alerta que precede qualquer conversa sobre margem, quando existe. */
function unpricedBlock(summary: AdminUsageSummary): string {
  if (summary.unpricedEvents === 0) return "";
  const share =
    summary.totals.totalEvents > 0 ? summary.unpricedEvents / summary.totals.totalEvents : 0;
  return [
    "",
    "── ATENÇÃO: CUSTO SUBESTIMADO ──",
    `[MEDIDO] ${INT.format(summary.unpricedEvents)} das ${INT.format(summary.totals.totalEvents)} chamadas (${pct(share)}) rodaram em modelos que NÃO estão na tabela de preços interna (lib/llm/pricing.ts): ${summary.unpricedModels.join(", ")}.`,
    "Essas chamadas gravaram custo ZERO no banco. Todo custo, margem e custo",
    "por moeda deste briefing está subestimado na proporção do que elas",
    "consumiram de verdade. Isto é bug de contabilidade, não de preço.",
  ].join("\n");
}

function actionsBlock(
  summary: AdminUsageSummary,
  rate: UsdBrlRate | null,
  settings: CoinEconomicsSettings
): string {
  const lines: string[] = ["── POR AÇÃO COBRÁVEL [MEDIDO, exceto a margem] ──"];

  for (const row of summary.byAction) {
    if (row.key === "unbilled" || row.key === "internal") continue;
    const action = BILLABLE_ACTION_BY_KEY[row.key as BillableActionKey];
    const e = computeActionEconomics({
      costUsd: row.totalCostUsd,
      usdToBrl: rate?.rate ?? null,
      coins: row.coins,
      executions: row.executions,
      coinsPerExecution: action.coins,
      settings,
    });
    lines.push(
      `${action.label} — cobra ${action.coins} moedas por ${action.unit}. ` +
        `${INT.format(row.executions)} execuções, ${INT.format(row.coins)} moedas debitadas, ` +
        `${INT.format(row.events)} chamadas de LLM. ` +
        `Custo total ${money(rate ? row.totalCostUsd * rate.rate : null)}; ` +
        `por ${action.unit} ${money(e.costPerExecutionBrl)}; ` +
        `por ${INT.format(COINS_PER_COST_UNIT)} moedas ${money(e.costPerThousandCoinsBrl)}. ` +
        `MARGEM AO PREÇO DE HOJE ${pct(e.marginAtCurrentPrice)} (é esta que decide preço). ` +
        `Margem realizada sobre as moedas debitadas: ${pct(e.realizedMargin)}. ` +
        (ledgerDivergesFromPrice(e.ledgerCoinsPerExecution, action.coins)
          ? `ATENÇÃO: o ledger cobrou em média ${e.ledgerCoinsPerExecution?.toFixed(1)} moedas por ${action.unit} no período, e não as ${action.coins} de hoje — houve mudança de preço dentro da janela, ou cobrança sem execução medida. É por isso que as duas margens discordam. `
          : "") +
        `Para fechar o alvo cobraria ${e.suggestedCoinsPerExecution == null ? "—" : Math.max(1, Math.ceil(e.suggestedCoinsPerExecution))} moedas/${action.unit}. ` +
        `(${action.note})`
    );
  }

  const unbilled = summary.byAction.find((a) => a.key === "unbilled");
  if (unbilled) {
    const share =
      summary.totals.totalCostUsd > 0 ? unbilled.totalCostUsd / summary.totals.totalCostUsd : 0;
    lines.push(
      "",
      `[MEDIDO] GASTO SEM COBRANÇA: ${money(rate ? unbilled.totalCostUsd * rate.rate : null)} em ${INT.format(unbilled.events)} chamadas (${pct(share)} do custo do período). ` +
        "É consulta de versículo e formatação fora de uma gravação, mais eventos cuja sessão foi apagada. " +
        "Nenhuma moeda foi debitada por eles: este custo não entra em margem nenhuma e sai inteiro do lucro."
    );
  }

  const internal = summary.byAction.find((a) => a.key === "internal");
  if (internal && internal.events > 0) {
    lines.push(
      `[MEDIDO] CUSTO INTERNO DO PAINEL: ${money(rate ? internal.totalCostUsd * rate.rate : null)} em ${INT.format(internal.events)} chamadas — esta própria análise. Despesa operacional, nunca terá moeda atrás.`
    );
  }

  return lines.join("\n");
}

function routesBlock(summary: AdminUsageSummary, rate: UsdBrlRate | null): string {
  const lines: string[] = [
    "── POR ROTA E MODELO [MEDIDO] ── (ordenado por custo, top 20)",
    "Cada rota é uma etapa do produto. O modelo entre parênteses é o que ela",
    "rodou de fato no período — é onde uma troca de modelo se decide.",
  ];
  for (const r of summary.byRoute.slice(0, 20)) {
    const models = r.models
      .map(
        (m) =>
          `${m.model}${m.priced ? "" : " [SEM PREÇO NA TABELA — custo gravado como zero]"}: ${INT.format(m.events)} chamadas, ${money(rate ? m.totalCostUsd * rate.rate : null)}`
      )
      .join(" | ");
    lines.push(
      `${r.route}: ${INT.format(r.events)} chamadas, ${money(rate ? r.totalCostUsd * rate.rate : null)} — ${models}`
    );
  }
  return lines.join("\n");
}

function usersAndSessionsBlock(summary: AdminUsageSummary, rate: UsdBrlRate | null): string {
  const lines: string[] = ["── CONCENTRAÇÃO [MEDIDO] ──"];

  const top = summary.byUser.slice(0, 10);
  const topCost = top.reduce((sum, u) => sum + u.totalCostUsd, 0);
  const topShare = summary.totals.totalCostUsd > 0 ? topCost / summary.totals.totalCostUsd : 0;
  lines.push(
    `As ${top.length} contas que mais gastaram moedas respondem por ${pct(topShare)} do custo do período.`
  );
  for (const u of top) {
    // Sem e-mail e sem nome: o analista não decide nada com a identidade de
    // uma pessoa, e mandá-la para a OpenAI num prompt que fica 30 dias
    // retido lá seria vazar a base de usuários por conveniência de redação.
    lines.push(
      `  conta ${u.userId.slice(0, 8)}: ${INT.format(u.totalCoins)} moedas, ${INT.format(u.events)} chamadas, ${money(rate ? u.totalCostUsd * rate.rate : null)}`
    );
  }

  const withCoins = summary.bySession.filter((s) => s.costPerCoinUsd != null);
  if (withCoins.length > 0) {
    const sorted = [...withCoins].sort((a, b) => (a.costPerCoinUsd ?? 0) - (b.costPerCoinUsd ?? 0));
    const median = sorted[Math.floor(sorted.length / 2)].costPerCoinUsd ?? 0;
    const worst = sorted.slice(-5).reverse();
    lines.push(
      "",
      `Custo por ${INT.format(COINS_PER_COST_UNIT)} moedas nas ${INT.format(withCoins.length)} sessões recentes com cobrança — mediana ${money(rate ? median * COINS_PER_COST_UNIT * rate.rate : null)}.`,
      "As cinco mais caras:"
    );
    for (const s of worst) {
      const minutes = s.durationMs ? Math.round(s.durationMs / 60000) : null;
      lines.push(
        `  modo ${s.mode ?? "?"}, ${minutes == null ? "duração desconhecida" : `${minutes} min`}, ${INT.format(s.events)} chamadas, ${INT.format(s.coins)} moedas → ${money(rate ? (s.costPerCoinUsd ?? 0) * COINS_PER_COST_UNIT * rate.rate : null)} por ${INT.format(COINS_PER_COST_UNIT)}`
      );
    }
  }

  return lines.join("\n");
}

function totalsBlock(summary: AdminUsageSummary, rate: UsdBrlRate | null): string {
  const { totals, overallCostPerCoinUsd } = summary;
  const costPerThousand =
    rate && overallCostPerCoinUsd != null
      ? overallCostPerCoinUsd * COINS_PER_COST_UNIT * rate.rate
      : null;
  return [
    "── TOTAIS DO PERÍODO [MEDIDO] ──",
    `Custo da OpenAI: ${money(rate ? totals.totalCostUsd * rate.rate : null)} em ${INT.format(totals.totalEvents)} chamadas.`,
    `  desse total, custo COBRÁVEL (ações que debitaram moeda): ${money(rate ? summary.billableCostUsd * rate.rate : null)}.`,
    `  gasto SEM COBRANÇA, fora de toda margem: ${money(rate ? summary.unchargedCostUsd * rate.rate : null)}.`,
    `  custo INTERNO do painel (esta própria análise): ${money(rate ? summary.internalCostUsd * rate.rate : null)}.`,
    `Tokens: ${INT.format(totals.totalPromptTokens)} de entrada, ${INT.format(totals.totalCompletionTokens)} de saída.`,
    `Áudio transcrito: ${(totals.totalAudioSeconds / 60).toFixed(1)} minutos.`,
    `Moedas debitadas dos usuários: ${INT.format(totals.totalCoins)}.`,
    `Custo por ${INT.format(COINS_PER_COST_UNIT)} moedas, no agregado: ${money(costPerThousand)}.`,
    "  Esse agregado sai SÓ do custo cobrável: as duas linhas de fora estão",
    "  discriminadas acima. NÃO as some de volta para 'corrigir' a margem —",
    "  elas saem do lucro, não do preço de uma ação, e misturadas produzem um",
    "  número que contradiz todas as margens por ação sem que nenhuma esteja",
    "  errada. Se elas forem grandes, o item é sobre gasto gratuito, e não sobre",
    "  preço mal ajustado.",
  ].join("\n");
}

async function metricsBlock(summary: AdminUsageSummary, rate: UsdBrlRate | null): Promise<string> {
  const costPerThousandCents =
    rate && summary.overallCostPerCoinUsd
      ? Math.round(summary.overallCostPerCoinUsd * COINS_PER_COST_UNIT * rate.rate * 100)
      : 0;
  const { funnel, welcomeCoins, revenue, liability, medianDaysToSubscribe } =
    await loadAdminMetrics({}, costPerThousandCents);

  const lines = [
    "── FUNIL, BASE COMPLETA [MEDIDO] ──",
    `Cadastros: ${INT.format(funnel.signups)}`,
    `Gastaram ao menos 1 moeda: ${INT.format(funnel.spentAny)}`,
    `Gravaram uma sessão: ${INT.format(funnel.activated)} (ativação ${pct(funnel.activationRate)})`,
    `Zeraram as ${INT.format(INITIAL_COIN_BALANCE)} moedas iniciais: ${INT.format(funnel.exhaustedFreeCoins)}`,
    `Assinaram alguma vez: ${INT.format(funnel.everSubscribed)}`,
    `Assinantes hoje: ${INT.format(funnel.activeSubscribers)} (conversão ${pct(funnel.conversionRate)})`,
    `Mediana de dias entre cadastro e primeira assinatura: ${medianDaysToSubscribe ?? "sem assinatura registrada"}`,
    "",
    "── USO DAS MOEDAS DE BOAS-VINDAS, POR CONTA [MEDIDO] ──",
    `Não usaram nenhuma: ${INT.format(welcomeCoins.untouched)}`,
    `Usaram até metade: ${INT.format(welcomeCoins.partial)}`,
    `Usaram mais da metade: ${INT.format(welcomeCoins.most)}`,
    `Gastaram todas: ${INT.format(welcomeCoins.exhausted)}`,
    "",
    "── RECEITA [MEDIDO] ──",
    `MRR: ${formatBrl(revenue.mrrCents)}`,
    `ARPU: ${formatBrl(revenue.arpuCents)}`,
    `Taxa estimada do Stripe sobre o MRR: ${formatBrl(revenue.stripeFeeCents)}/mês`,
    `Assinantes por plano: Pessoal ${INT.format(revenue.activeByPlan.pessoal)}, Estudioso ${INT.format(revenue.activeByPlan.estudioso)}`,
    `Com cancelamento agendado: ${INT.format(revenue.cancelScheduled)}`,
    "",
    "── PASSIVO DE MOEDAS [MEDIDO] ──",
    `Creditadas na vida: ${INT.format(liability.granted)}`,
    `Gastas na vida: ${INT.format(liability.spent)}`,
    `Em circulação (compradas e não gastas): ${INT.format(liability.outstanding)}`,
    costPerThousandCents > 0
      ? `Custo de OpenAI que esse saldo representa, ao custo medido de hoje: ${formatBrl(liability.outstandingCostCents)}`
      : "Sem câmbio ou sem moedas gastas: o passivo não pôde ser convertido em real.",
    "",
    "── PARA A CONTA POR PLANO [MEDIDO] ──",
    "A taxa do Stripe sobre uma cobrança avulsa deste tamanho, para você fazer",
    "a conta líquida de cada plano:",
    `  Pessoal ${formatBrl(PLANS.pessoal.priceCents)} → taxa ${formatBrl(stripeFeeCents(PLANS.pessoal.priceCents))}`,
    `  Estudioso ${formatBrl(PLANS.estudioso.priceCents)} → taxa ${formatBrl(stripeFeeCents(PLANS.estudioso.priceCents))}`,
  ];
  return lines.join("\n");
}

export type Briefing = {
  text: string;
  windowDays: number;
};

/**
 * Monta o briefing do escopo. Uma passada só pelos eventos — o mesmo
 * `loadAdminUsageSummary` que alimenta as três telas — porque duas passadas
 * seriam duas verdades.
 */
export async function buildInsightsBriefing(scope: AdminInsightScope): Promise<Briefing> {
  const [summary, rate, settings] = await Promise.all([
    loadAdminUsageSummary({ from: windowFrom() }),
    getUsdToBrl(),
    getCoinEconomics(),
  ]);

  const head = `Período analisado: últimos ${INSIGHTS_WINDOW_DAYS} dias, até ${new Date().toISOString().slice(0, 10)}.`;

  const parts: string[] = [head, "", rulerBlock(settings, rate), unpricedBlock(summary), ""];

  if (scope === "pricing") {
    parts.push(
      totalsBlock(summary, rate),
      "",
      actionsBlock(summary, rate, settings),
      "",
      routesBlock(summary, rate)
    );
  } else if (scope === "usage") {
    parts.push(
      totalsBlock(summary, rate),
      "",
      routesBlock(summary, rate),
      "",
      usersAndSessionsBlock(summary, rate),
      "",
      actionsBlock(summary, rate, settings)
    );
  } else {
    parts.push(totalsBlock(summary, rate), "", await metricsBlock(summary, rate));
  }

  return { text: parts.join("\n"), windowDays: INSIGHTS_WINDOW_DAYS };
}
