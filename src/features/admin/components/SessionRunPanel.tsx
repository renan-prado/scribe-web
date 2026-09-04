import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/admin/components/AdminCards";
import { type CoinEconomicsSettings, computeActionEconomics } from "@/lib/coins/economics";
import { COIN_COSTS } from "@/lib/coins/pricing";
import type { SessionRun, SessionRunsReport } from "@/lib/db/admin/session-runs";
import type { MoneyFormatter } from "@/lib/fx/format";
import {
  type ContractRange,
  type ContractVerdict,
  judge,
  STUDY_CONTRACT,
  type StudyMetrics,
} from "@/lib/study/metrics";
import { cn } from "@/lib/utils";

/**
 * Uma sessão aberta EXECUÇÃO POR EXECUÇÃO.
 *
 * Existe para uma pergunta que nenhuma outra tela responde: **o que mudou
 * entre a execução de ontem e a de agora?** Os cards acima e `/admin/usage`
 * agregam, e um reprocessamento soma na mesma sessão — o número resultante não
 * descreve nenhuma das duas execuções.
 *
 * Três leituras que a tela precisa preservar:
 *
 *   1. **Só a última execução tem texto.** Reprocessar sobrescreve o estudo
 *      (`updateDeepening`), então as anteriores existem em custo e não em
 *      qualidade. A tela diz isso em vez de repetir as métricas ao lado de
 *      cada execução como se cada uma tivesse sido medida.
 *   2. **Raciocínio nulo não é raciocínio zero.** Nulo é chamada anterior à
 *      migração 0036, ou modelo que não raciocina. Zero MEDIDO é informação —
 *      é o caso do respondedor — e some se os dois virarem "0".
 *   3. **A margem sai de `computeActionEconomics`**, a mesma conta dos cards
 *      acima, com a régua que o admin girou. Uma segunda fórmula de margem
 *      nesta página acabaria discordando da primeira.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const INT = new Intl.NumberFormat("pt-BR");

function secs(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/**
 * O teto em que a rota morre DEPOIS de já ter debitado as moedas. Espelha
 * `maxDuration` em `app/api/deepening/*`. Marcado em vermelho porque estourá-lo
 * é o pior desfecho do produto, não uma lentidão.
 */
const ROUTE_BUDGET_MS = 300_000;

type Props = {
  report: SessionRunsReport;
  usdToBrl: number | null;
  settings: CoinEconomicsSettings;
  money: MoneyFormatter;
};

export function SessionRunPanel({ report, usdToBrl, settings, money }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-scriba-ink-strong">
            {report.sessionTitle?.trim() || "Sessão sem título"}
          </h2>
          <span className="font-mono text-[11px] font-light text-scriba-ink-mute">
            {report.sessionId}
            {report.captureMode ? ` · ${report.captureMode}` : ""}
          </span>
        </div>
        {report.otherEvents > 0 ? (
          <span className="text-[11px] font-light text-scriba-ink-mute">
            Fora do estudo: {money(report.otherCostUsd)} em {INT.format(report.otherEvents)}{" "}
            chamadas (transcrição, feed, resumo)
          </span>
        ) : null}
      </header>

      {report.runs.length === 0 ? (
        <EmptyState>Nenhuma execução de estudo nesta sessão.</EmptyState>
      ) : (
        report.runs.map((run, i) => (
          <RunCard
            key={run.startedAt}
            run={run}
            money={money}
            usdToBrl={usdToBrl}
            settings={settings}
            isLatest={i === 0}
            ordinal={report.runs.length - i}
          />
        ))
      )}

      {report.study ? (
        <QualityCard
          metrics={report.study.metrics}
          title={report.study.title}
          record={report.study.record}
          runCount={report.runs.length}
        />
      ) : null}
    </section>
  );
}

function RunCard({
  run,
  money,
  usdToBrl,
  settings,
  isLatest,
  ordinal,
}: {
  run: SessionRun;
  money: MoneyFormatter;
  usdToBrl: number | null;
  settings: CoinEconomicsSettings;
  isLatest: boolean;
  ordinal: number;
}) {
  const economics = computeActionEconomics({
    costUsd: run.totalCostUsd,
    usdToBrl,
    coins: COIN_COSTS.deepening,
    executions: 1,
    coinsPerExecution: COIN_COSTS.deepening,
    settings,
  });
  const margin = economics.marginAtCurrentPrice;
  const overBudget = run.llmMs > ROUTE_BUDGET_MS;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-scriba-hairline bg-scriba-paper p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            Execução {ordinal}
          </span>
          {isLatest ? (
            <span className="rounded-full bg-scriba-blue-soft px-2 py-0.5 text-[10px] font-medium text-scriba-ink-strong">
              a mais recente
            </span>
          ) : null}
          <span className="text-[11px] font-light text-scriba-ink-mute">
            {DATE_FMT.format(new Date(run.startedAt))}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-5">
          <Figure label="Custo" value={money(run.totalCostUsd)} />
          <Figure
            label={`Margem a ${COIN_COSTS.deepening} moedas`}
            value={margin == null ? "—" : `${(margin * 100).toFixed(1).replace(".", ",")}%`}
            tone={margin == null ? undefined : margin <= 0 ? "bad" : "good"}
          />
          <Figure
            label="Tempo de LLM"
            value={secs(run.llmMs)}
            tone={overBudget ? "bad" : undefined}
            hint={overBudget ? "acima do maxDuration de 300s da rota" : undefined}
          />
        </div>
      </header>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
              <TableHead className="text-right">Saída</TableHead>
              <TableHead className="text-right">Raciocínio</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.steps.map((step) => (
              <TableRow key={`${step.createdAt}-${step.route}`}>
                <TableCell className="font-medium text-scriba-ink-strong">{step.route}</TableCell>
                <TableCell className="font-mono text-[11px]">{step.model}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {INT.format(step.promptTokens ?? 0)}
                  {step.cachedTokens ? (
                    <span className="font-light text-scriba-ink-mute">
                      {" "}
                      ({INT.format(step.cachedTokens)} cache)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {INT.format(step.completionTokens ?? 0)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    step.reasoningTokens == null && "font-light text-scriba-ink-mute"
                  )}
                >
                  {step.reasoningTokens == null ? "não medido" : INT.format(step.reasoningTokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(step.costUsd)}</TableCell>
                <TableCell className="text-right tabular-nums">{secs(step.latencyMs)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type QualityRecord = {
  questions: { text: string }[];
  answered: string[];
  guard?: { blockedByGuard: string[]; rewrites: number };
};

function QualityCard({
  metrics,
  title,
  record,
  runCount,
}: {
  metrics: StudyMetrics;
  title: string;
  record: QualityRecord | null;
  runCount: number;
}) {
  const rows: {
    label: string;
    value: number | null;
    range: ContractRange;
    fmt?: (n: number) => string;
  }[] = [
    {
      label: "Palavras autorais",
      value: metrics.authoredWords,
      range: STUDY_CONTRACT.authoredWords,
    },
    { label: "Seções", value: metrics.sections, range: STUDY_CONTRACT.sections },
    {
      label: "Parágrafos por seção",
      value: metrics.paragraphsPerSection,
      range: STUDY_CONTRACT.paragraphsPerSection,
      fmt: (n) => n.toFixed(1).replace(".", ","),
    },
    {
      label: "Palavras por parágrafo",
      value: metrics.wordsPerParagraph,
      range: STUDY_CONTRACT.wordsPerParagraph,
      fmt: (n) => String(Math.round(n)),
    },
    {
      label: "Passagens ancoradas",
      value: metrics.bibleQuotes,
      range: STUDY_CONTRACT.bibleQuotes,
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-scriba-hairline bg-scriba-paper p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-scriba-ink-strong">{title}</h3>
        <span className="text-[11px] font-light text-scriba-ink-mute">
          {runCount > 1
            ? "Do estudo SALVO — ou seja, da última execução. Reprocessar sobrescreve o texto, então as anteriores existem em custo, não em qualidade."
            : "Contra o contrato declarado no prompt do redator."}
        </span>
      </header>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <ContractStat
            key={row.label}
            label={row.label}
            value={row.value == null ? "—" : (row.fmt ?? ((n: number) => INT.format(n)))(row.value)}
            range={row.range}
            verdict={judge(row.value, row.range)}
          />
        ))}
        <ContractStat
          label="Blocos estruturados"
          value={INT.format(metrics.structuredBlocks)}
          hint={`de ${INT.format(metrics.totalBlocks)} blocos`}
        />
      </dl>

      {record ? (
        <p className="text-[11px] font-light text-scriba-ink-mute">
          {record.questions.length} perguntas levantadas ·{" "}
          {record.guard?.blockedByGuard.length ?? 0} cortadas pelo guardião ·{" "}
          {record.answered.length} respondidas
          {record.guard?.rewrites ? " · o redator teve de reescrever a tese" : ""}
        </p>
      ) : null}
    </div>
  );
}

function ContractStat({
  label,
  value,
  range,
  verdict,
  hint,
}: {
  label: string;
  value: string;
  range?: ContractRange;
  verdict?: ContractVerdict;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          verdict === "ok" && "text-scriba-green",
          (verdict === "below" || verdict === "above") && "text-destructive",
          !verdict && "text-scriba-ink-strong"
        )}
      >
        {value}
        <span className="ml-1.5 text-[11px] font-light text-scriba-ink-mute">
          {hint ?? (range ? `alvo ${range.min}–${range.max}` : "")}
        </span>
      </dd>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={hint}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "good" && "text-scriba-green",
          tone === "bad" && "text-destructive",
          !tone && "text-scriba-ink-strong"
        )}
      >
        {value}
      </span>
    </div>
  );
}
