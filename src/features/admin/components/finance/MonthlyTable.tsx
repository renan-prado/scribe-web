import type { MonthlyRow } from "@/lib/finance/aggregate";
import { formatBrlCents, formatPercent } from "@/lib/finance/money";
import { formatMonthKeyShort } from "@/lib/finance/recurrence";

/**
 * A visão mês a mês (§7 da especificação), em COMPETÊNCIA.
 *
 * Tabela e não gráfico como peça principal: a pergunta que ela responde é
 * "quanto exatamente", e um gráfico responde "para onde". O gráfico existe
 * logo acima, em `MonthlyBars`, para a leitura de relance, os dois juntos,
 * porque a especificação pede as duas leituras e elas não competem.
 *
 * A tabela é TRANSPOSTA em relação ao instinto: as métricas são as linhas e os
 * meses são as colunas. É como um DRE se lê, e é o que permite correr o olho
 * por uma linha só ("a margem está subindo?") em vez de comparar células
 * distantes. O custo é a rolagem horizontal, que o `admin-table` já resolve.
 *
 * Não há linha de "previsto" misturada às realizadas: o previsto tem cor e
 * linha próprias, embaixo, porque somar uma estimativa a um fato dentro da
 * mesma linha é exatamente o que o §14 pede para não fazer.
 */
export function MonthlyTable({ months }: { months: MonthlyRow[] }) {
  if (months.length === 0) {
    return <p className="text-sm font-light text-scriba-ink-mute">Sem meses no período.</p>;
  }

  const rows: Array<{
    label: string;
    hint?: string;
    pick: (m: MonthlyRow) => string;
    strong?: boolean;
    muted?: boolean;
    signed?: boolean;
  }> = [
    { label: "Receita", pick: (m) => formatBrlCents(m.revenueCents), strong: true },
    {
      label: "· medida",
      hint: "Assinaturas e pacotes, do ledger de créditos",
      pick: (m) => formatBrlCents(m.revenueMeasuredCents),
      muted: true,
    },
    {
      label: "· lançada",
      hint: "Receitas cadastradas à mão",
      pick: (m) => formatBrlCents(m.revenueManualCents),
      muted: true,
    },
    { label: "Despesas", pick: (m) => formatBrlCents(m.expenseCents), strong: true },
    {
      label: "· IA e taxas",
      hint: "Medido: llm_usage_events × câmbio, mais a taxa do Stripe",
      pick: (m) => formatBrlCents(m.expenseMeasuredCents),
      muted: true,
    },
    {
      label: "· recorrentes",
      hint: "Equivalente mensal dos contratos ativos",
      pick: (m) => formatBrlCents(m.expenseProvisionedCents),
      muted: true,
    },
    {
      label: "· avulsas",
      hint: "Lançamentos que não vieram de um contrato",
      pick: (m) => formatBrlCents(m.expenseManualCents),
      muted: true,
    },
    { label: "Custos fixos", pick: (m) => formatBrlCents(m.fixedCents), muted: true },
    { label: "Custos variáveis", pick: (m) => formatBrlCents(m.variableCents), muted: true },
    { label: "Imposto estimado", pick: (m) => formatBrlCents(m.taxCents), muted: true },
    {
      label: "Lucro",
      hint: "Receita menos despesas e imposto",
      pick: (m) => formatBrlCents(m.netProfitCents),
      strong: true,
      signed: true,
    },
    { label: "Margem", pick: (m) => formatPercent(m.marginRatio), strong: true },
    {
      label: "Caixa do mês",
      hint: "O que efetivamente entrou menos o que saiu",
      pick: (m) => formatBrlCents(m.cashNetCents),
      signed: true,
    },
    {
      label: "Previsto (a pagar)",
      hint: "Lançamentos com status Previsto, fora dos totais acima",
      pick: (m) => formatBrlCents(m.plannedExpenseCents),
      muted: true,
    },
  ];

  return (
    <div className="admin-table">
      <div data-slot="table-container" className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-scriba-paper text-left">Métrica</th>
              {months.map((m) => (
                <th key={m.month} className="text-right">
                  {formatMonthKeyShort(m.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-scriba-hairline last:border-0">
                <td
                  className="sticky left-0 z-10 bg-scriba-paper whitespace-nowrap"
                  title={row.hint}
                >
                  <span
                    className={
                      row.strong
                        ? "text-[13px] font-semibold text-scriba-ink-strong"
                        : "text-[12.5px] font-light text-scriba-ink-soft"
                    }
                  >
                    {row.label}
                  </span>
                </td>
                {months.map((m) => (
                  <td key={m.month} className="text-right">
                    <span
                      className={valueClass(row.strong, row.muted, row.signed ? sign(row, m) : 0)}
                    >
                      {row.pick(m)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sign(row: { label: string }, m: MonthlyRow): number {
  const value = row.label === "Lucro" ? m.netProfitCents : m.cashNetCents;
  return value === 0 ? 0 : value > 0 ? 1 : -1;
}

function valueClass(strong?: boolean, muted?: boolean, signed = 0): string {
  const base = "font-mono text-xs tabular-nums";
  // O prejuízo é a única coisa pintada. Colorir lucro e prejuízo juntos faz a
  // tabela inteira virar semáforo, e aí nada chama atenção.
  if (signed < 0) return `${base} font-semibold text-scriba-rose-accent`;
  if (strong) return `${base} font-semibold text-scriba-ink-strong`;
  if (muted) return `${base} text-scriba-ink-mute`;
  return `${base} text-scriba-ink`;
}

/**
 * As barras de receita × despesa, um par por mês.
 *
 * Barras e não linha: a comparação que interessa é entre duas grandezas DENTRO
 * do mesmo mês, e uma linha convida a ler a inclinação, que é a pergunta da
 * tabela. A escala é comum aos dois lados, normalizar cada série pelo próprio
 * máximo faria uma despesa pequena parecer do tamanho de uma receita grande.
 */
export function MonthlyBars({ months }: { months: MonthlyRow[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenueCents, m.expenseCents)));

  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-3">
      {months.map((m) => (
        <div key={m.month} className="flex min-w-[42px] flex-1 flex-col items-center gap-1.5">
          <div className="flex h-28 w-full items-end justify-center gap-1">
            <div
              className="w-1/2 rounded-t-sm bg-scriba-mint-strong"
              style={{ height: `${barHeight(m.revenueCents, max)}%` }}
              title={`Receita: ${formatBrlCents(m.revenueCents)}`}
            />
            <div
              className="w-1/2 rounded-t-sm bg-scriba-rose-accent/70"
              style={{ height: `${barHeight(m.expenseCents, max)}%` }}
              title={`Despesas: ${formatBrlCents(m.expenseCents)}`}
            />
          </div>
          <span className="text-[10px] font-light text-scriba-ink-mute">
            {formatMonthKeyShort(m.month)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Um valor não-zero nunca desenha barra de altura zero: "pouco" e "nada" são
 * leituras diferentes, e uma barra invisível diz a segunda. */
function barHeight(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.max(2, (value / max) * 100);
}
