import type { Metadata } from "next";
import Link from "next/link";
import { CoinMark } from "@/components/icons/CoinMark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard, type Tone } from "@/features/admin/components/AdminCards";
import { AdminInsightsCard } from "@/features/admin/components/AdminInsightsCard";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { CoinEconomicsForm } from "@/features/admin/components/CoinEconomicsForm";
import { FxRateBadge } from "@/features/admin/components/FxRateBadge";
import { readAdminInsights } from "@/lib/admin/insights/store";
import {
  BILLABLE_ACTION_BY_KEY,
  type BillableActionKey,
  NON_BILLABLE_ACTION_KEYS,
} from "@/lib/coins/billable";
import {
  type ActionEconomics,
  COINS_PER_COST_UNIT,
  type CoinEconomicsSettings,
  computeActionEconomics,
  ledgerDivergesFromPrice,
} from "@/lib/coins/economics";
import { getCoinEconomics, hasCustomCoinEconomics } from "@/lib/coins/settings";
import { type AdminUsageSummary, loadAdminUsageSummary } from "@/lib/db/admin/usage";
import { getUsdToBrl, type UsdBrlRate } from "@/lib/fx/usd-brl";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Precificação" };
export const dynamic = "force-dynamic";

/**
 * Custo por AÇÃO — a tela que responde "continuo cobrando 7 moedas o minuto?".
 *
 * /admin/usage já responde "para onde o dinheiro foi": rota, usuário, sessão.
 * Nenhum daqueles cortes responde à pergunta de preço, porque preço não é
 * cobrado por rota — é cobrado por ação, e uma ação é várias rotas (o Modo Ao
 * Vivo é transcrição + três pipelines + resumo + os cards de acompanhamento).
 * Somar rota por rota à mão para chegar no minuto é exatamente o trabalho que
 * esta tela existe para não ter de ser refeito toda vez.
 *
 * Tudo o que é por MOEDA é publicado por MILHEIRO, pela razão que já governa
 * `lib/fx/format.ts`: uma moeda custa na casa do centésimo de centavo, e em
 * duas casas decimais todas as ações empatariam em "R$ 0,00" — que é justamente
 * a diferença que a tela existe para mostrar. É o milheiro que faz o número
 * caber em REAL E CENTAVO, e por isso ele sai com duas casas, iguais às de
 * `/admin/usage`. As quatro casas ficaram só onde ainda fazem falta: o custo de
 * UMA execução, que num minuto de transcrição continua abaixo do centavo.
 *
 * Os dois lados da conta têm origens diferentes, e a distinção é o ponto:
 *   - o CUSTO é medido (`llm_usage_events` × câmbio do dia), nunca constante;
 *   - a RECEITA é simulada, com o valor da moeda que o admin girar na régua.
 */

const INT = new Intl.NumberFormat("pt-BR");
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_FINE = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const RANGES = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "all", label: "Tudo", days: null },
] as const;

function rangeToFrom(range: string): string | undefined {
  const found = RANGES.find((r) => r.key === range) ?? RANGES[1];
  if (!found.days) return undefined;
  return new Date(Date.now() - found.days * 24 * 60 * 60 * 1000).toISOString();
}

function money(value: number | null): string {
  return value == null ? "—" : BRL.format(value);
}

function moneyFine(value: number | null): string {
  return value == null ? "—" : BRL_FINE.format(value);
}

function percent(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

type PageProps = {
  searchParams: Promise<{ range?: string }>;
};

export default async function AdminPricingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.range) ? (sp.range as string) : "30d";

  const [summary, rate, settings, isCustom, insights] = await Promise.all([
    loadAdminUsageSummary({ from: rangeToFrom(range) }),
    getUsdToBrl(),
    getCoinEconomics(),
    hasCustomCoinEconomics(),
    readAdminInsights("pricing"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Precificação"
        subtitle="O que cada ação cobra, o que ela custa de verdade, e a margem que sobra."
        actions={<RangePills current={range} />}
      />

      <CoinEconomicsForm settings={settings} isCustom={isCustom} />

      <AdminInsightsCard scope="pricing" initial={insights} />

      <OverallGrid summary={summary} rate={rate} settings={settings} />

      <ActionsTable summary={summary} rate={rate} settings={settings} />

      <UnbilledNote summary={summary} rate={rate} />

      <FxRateBadge rate={rate} />
    </div>
  );
}

function RangePills({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-1 rounded-full border border-scriba-hairline-soft bg-scriba-paper p-1">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "30d" ? "/admin/precificacao" : `/admin/precificacao?range=${r.key}`}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            r.key === current
              ? "bg-scriba-blue-soft text-scriba-blue-ink"
              : "text-scriba-ink-mute hover:text-scriba-ink"
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

type EconomicsProps = {
  summary: AdminUsageSummary;
  rate: UsdBrlRate | null;
  settings: CoinEconomicsSettings;
};

/**
 * O agregado. Vem antes da tabela porque é a leitura que decide se há um
 * problema de preço em algum lugar; a tabela diz ONDE ele está.
 *
 * A margem daqui é COBRÁVEL contra COBRÁVEL — `overallCostPerCoinUsd` já
 * exclui o gasto sem cobrança e as chamadas do próprio painel. Enquanto os
 * incluía, este cartão respondia a uma pergunta diferente da de cada linha da
 * tabela abaixo, e a diferença aparecia como uma margem agregada pior que
 * todas as individuais, sem nada na tela que explicasse por quê. O que ficou
 * de fora aparece no cartão do custo medido e, com nome e conserto, em
 * `UnbilledNote`.
 */
function OverallGrid({ summary, rate, settings }: EconomicsProps) {
  const { totals, overallCostPerCoinUsd } = summary;
  const costPerThousand =
    rate && overallCostPerCoinUsd != null
      ? overallCostPerCoinUsd * COINS_PER_COST_UNIT * rate.rate
      : null;
  const margin =
    costPerThousand != null ? 1 - costPerThousand / settings.pricePerThousandBrl : null;

  const marginTone: Tone =
    margin != null && margin < settings.targetMarginPct / 100 ? "rose" : "mint";

  const totalCostBrl = rate ? totals.totalCostUsd * rate.rate : null;
  const impliedRevenue = (totals.totalCoins / COINS_PER_COST_UNIT) * settings.pricePerThousandBrl;
  // O que ficou DE FORA do custo por moeda acima: gasto de usuário sem moeda
  // atrás mais as chamadas do próprio painel. Precisa estar à vista no mesmo
  // cartão do custo total, ou o leitor conclui que os dois números discordam.
  const excludedCostBrl = rate
    ? (summary.unchargedCostUsd + summary.internalCostUsd) * rate.rate
    : null;
  const excludedShare =
    totals.totalCostUsd > 0
      ? (summary.unchargedCostUsd + summary.internalCostUsd) / totals.totalCostUsd
      : 0;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        tone="blue"
        label="Custo medido"
        value={money(totalCostBrl)}
        hint={
          excludedShare > 0
            ? `${INT.format(totals.totalEvents)} chamadas à OpenAI · ${money(excludedCostBrl)} (${percent(excludedShare)}) fora da margem`
            : `${INT.format(totals.totalEvents)} chamadas à OpenAI`
        }
      />
      <KpiCard
        tone="cream"
        label="Moedas gastas"
        value={INT.format(totals.totalCoins)}
        hint={`${money(impliedRevenue)} de receita implícita à régua atual`}
        icon={<CoinMark size={22} />}
      />
      <KpiCard
        tone="rose"
        label={`Custo por ${INT.format(COINS_PER_COST_UNIT)} moedas`}
        value={money(costPerThousand)}
        hint={`só o custo cobrável, contra ${BRL.format(settings.pricePerThousandBrl)} de receita`}
        icon={<CoinMark size={22} />}
      />
      <KpiCard
        tone={marginTone}
        label="Margem realizada"
        value={percent(margin)}
        hint={`moedas debitadas contra o custo cobrável · alvo de ${percent(settings.targetMarginPct / 100)}`}
      />
    </section>
  );
}

function ActionsTable({ summary, rate, settings }: EconomicsProps) {
  const rows = summary.byAction
    .filter((row) => !NON_BILLABLE_ACTION_KEYS.includes(row.key))
    .map((row) => {
      const action = BILLABLE_ACTION_BY_KEY[row.key as BillableActionKey];
      const economics = computeActionEconomics({
        costUsd: row.totalCostUsd,
        usdToBrl: rate?.rate ?? null,
        coins: row.coins,
        executions: row.executions,
        coinsPerExecution: action.coins,
        settings,
      });
      return { row, action, economics };
    });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
        Por ação cobrável
      </h2>
      <div className="admin-table admin-card-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[19rem]">Ação</TableHead>
              <TableHead className="text-right">Cobra hoje</TableHead>
              <TableHead className="text-right">Execuções</TableHead>
              <TableHead className="text-right">Custo medido</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Custo/{INT.format(COINS_PER_COST_UNIT)}
                </span>
              </TableHead>
              <TableHead className="text-right">Margem ao preço de hoje</TableHead>
              <TableHead className="text-right">Preço p/ o alvo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ row, action, economics }) => (
              <TableRow key={row.key}>
                <TableCell className="align-top whitespace-normal pr-10">
                  <div className="flex max-w-[19rem] flex-col gap-1">
                    <span className="font-medium text-scriba-ink">{action.label}</span>
                    <span className="text-[11px] font-light leading-snug text-scriba-ink-mute">
                      {action.note}
                    </span>
                    {/* Os motivos do ledger, à vista. Sem eles, uma linha que
                        soma duas cobranças ("Estudo aprofundado" carrega
                        reprocessar estudo junto) parece contradizer o preço
                        que o menu do app mostra — e a discordância aparente
                        vira uma investigação de meia hora. */}
                    <span className="flex flex-wrap gap-1">
                      {action.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded bg-scriba-hairline-soft px-1.5 py-0.5 font-mono text-[10px] text-scriba-ink-soft"
                        >
                          {reason}
                        </span>
                      ))}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-top font-mono text-xs text-scriba-ink">
                  {INT.format(action.coins)}/{action.unit}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  {row.executions > 0 ? INT.format(row.executions) : "—"}
                  <span className="block text-[10px] font-light text-scriba-ink-mute">
                    {row.coins > 0 ? `${INT.format(row.coins)} moedas` : "sem cobrança"}
                  </span>
                </TableCell>
                <TableCell className="text-right align-top font-mono text-xs">
                  {money(rate ? row.totalCostUsd * rate.rate : null)}
                  <span className="block font-sans text-[10px] font-light text-scriba-ink-mute">
                    {economics.costPerExecutionBrl != null
                      ? `${moneyFine(economics.costPerExecutionBrl)}/${action.unit}`
                      : `${INT.format(row.events)} chamadas`}
                  </span>
                </TableCell>
                <TableCell className="text-right align-top font-mono text-xs">
                  {money(economics.costPerThousandCoinsBrl)}
                </TableCell>
                <TableCell className="text-right align-top">
                  <MarginCell
                    economics={economics}
                    coinsPerExecution={action.coins}
                    target={settings.targetMarginPct / 100}
                  />
                </TableCell>
                <TableCell className="text-right align-top">
                  <SuggestedPrice
                    suggested={economics.suggestedCoinsPerExecution}
                    current={action.coins}
                    unit={action.unit}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11.5px] font-light leading-relaxed text-scriba-ink-mute">
        Uma execução é um lançamento no ledger: um minuto INICIADO de gravação, um estudo, um
        reprocessamento. A margem é a de UMA execução ao preço que a ação cobra hoje — a mesma base
        da sugestão ao lado, para as duas colunas nunca se contradizerem. Quando aparece uma segunda
        linha “realizada”, é porque o ledger cobrou no período algo diferente do preço atual (uma
        mudança de preço dentro da janela, ou cobrança sem execução medida) — e aí a diferença entre
        as duas é o achado. O detalhe por rota e por modelo — onde vale trocar de modelo em vez de
        mexer no preço — está em{" "}
        <Link href="/admin/usage" className="underline underline-offset-2 hover:text-scriba-ink">
          Uso &amp; custos
        </Link>
        .
      </p>
    </section>
  );
}

/**
 * A margem AO PREÇO DE HOJE, mais a realizada quando as duas discordam.
 *
 * A coluna já mostrou só a realizada — custo contra as moedas que o ledger
 * debitou — e isso a punha em contradição direta com a coluna vizinha: o
 * Estudo aprofundado aparecia com -18% de margem e, ao lado, a sugestão de
 * COBRAR MENOS. Nenhuma das duas estava com defeito de cálculo; elas
 * respondiam a perguntas diferentes, e a tela não dizia qual era qual.
 *
 * A da decisão vem primeiro porque é a que a coluna seguinte usa. A realizada
 * só aparece quando o ledger cobrou algo diferente do preço de hoje, e nesse
 * caso ela é o achado: alguma coisa mudou de preço dentro do período, ou houve
 * cobrança sem execução medida.
 */
function MarginCell({
  economics,
  coinsPerExecution,
  target,
}: {
  economics: ActionEconomics;
  coinsPerExecution: number;
  target: number;
}) {
  const diverges = ledgerDivergesFromPrice(economics.ledgerCoinsPerExecution, coinsPerExecution);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <MarginBadge margin={economics.marginAtCurrentPrice} target={target} />
      {diverges && economics.realizedMargin != null ? (
        <span
          className="text-[10px] font-light leading-tight text-scriba-ink-mute"
          title={`O ledger cobrou em média ${economics.ledgerCoinsPerExecution?.toFixed(1).replace(".", ",")} moedas por execução no período, e não as ${INT.format(coinsPerExecution)} de hoje.`}
        >
          {percent(economics.realizedMargin)} realizada
        </span>
      ) : null}
    </div>
  );
}

function MarginBadge({ margin, target }: { margin: number | null; target: number }) {
  if (margin == null) {
    return <span className="text-xs text-scriba-ink-mute">—</span>;
  }
  const tone =
    margin < 0
      ? "bg-scriba-rose text-scriba-rose-accent"
      : margin < target
        ? "bg-scriba-cream text-scriba-cream-accent"
        : "bg-scriba-mint text-scriba-mint-accent";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
        tone
      )}
    >
      {percent(margin)}
    </span>
  );
}

/**
 * O número que fecha a pergunta. Vem arredondado PARA CIMA e em moeda inteira
 * porque é assim que o preço existe no produto — sugerir "4,3 moedas/min" seria
 * devolver a decisão em uma unidade que `COIN_COSTS` não sabe representar.
 */
function SuggestedPrice({
  suggested,
  current,
  unit,
}: {
  suggested: number | null;
  current: number;
  unit: string;
}) {
  if (suggested == null) {
    return <span className="text-xs text-scriba-ink-mute">—</span>;
  }
  const rounded = Math.max(1, Math.ceil(suggested));
  const delta = rounded - current;
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-xs text-scriba-ink-strong">
        {INT.format(rounded)}/{unit}
      </span>
      <span className="text-[10px] font-light text-scriba-ink-mute">
        {delta === 0
          ? "está no ponto"
          : delta > 0
            ? `+${INT.format(delta)} vs. hoje`
            : `${INT.format(delta)} vs. hoje`}
      </span>
    </div>
  );
}

/**
 * O gasto sem cobrança. Não é uma ação e não tem margem — é o que sai do
 * bolso sem entrar no ledger, e some completamente se a tela só listar o que
 * é cobrável.
 */
function UnbilledNote({ summary, rate }: { summary: AdminUsageSummary; rate: UsdBrlRate | null }) {
  const unbilled = summary.byAction.find((a) => a.key === "unbilled");
  const internal = summary.byAction.find((a) => a.key === "internal");
  if (!unbilled || unbilled.events === 0) return null;
  const share =
    summary.totals.totalCostUsd > 0 ? unbilled.totalCostUsd / summary.totals.totalCostUsd : 0;
  return (
    <section className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Gasto sem cobrança</h2>
      <p className="mt-1 text-[12.5px] font-light leading-relaxed text-scriba-ink-soft">
        <span className="font-mono font-medium text-scriba-ink-strong">
          {money(rate ? unbilled.totalCostUsd * rate.rate : null)}
        </span>{" "}
        em {INT.format(unbilled.events)} chamadas ({percent(share)} do custo do período) que não têm
        ação cobrável atrás: consulta de versículo e formatação fora de uma gravação, e eventos cuja
        sessão foi apagada. Nenhuma moeda foi debitada por eles, então este custo não aparece em
        margem nenhuma acima — ele sai inteiro do lucro.
      </p>
      {/* O custo do PAINEL fica numa frase à parte, e não somado acima, porque
          os dois têm consertos opostos: gasto sem cobrança é preço mal
          ajustado, custo interno é despesa nossa que nunca terá moeda atrás.
          Juntos, sugeririam cobrar do usuário por uma chamada que só o admin
          dispara. Omitido, o total do painel deixaria de bater com a fatura. */}
      {internal && internal.events > 0 ? (
        <p className="mt-2 text-[12.5px] font-light leading-relaxed text-scriba-ink-mute">
          À parte disso, {money(rate ? internal.totalCostUsd * rate.rate : null)} em{" "}
          {INT.format(internal.events)} chamadas são do próprio painel — a leitura da IA desta e das
          outras telas. Despesa operacional, não gasto de usuário.
        </p>
      ) : null}
    </section>
  );
}
