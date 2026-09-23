import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUsageSummary, UsageByVersion } from "@/features/admin/server/db/usage";
import type { MoneyFormatter } from "@/lib/fx/format";
import { cn } from "@/lib/utils";
import { INT, latency, moment, TABLE_SURFACE } from "./format";
import { SectionLabel } from "./notices";

/**
 * O corte por VERSÃO, a aba que responde "depois da 0.5.0, ficou mais caro ou
 * mais lento?".
 *
 * As outras abas cortam o ESPAÇO (rota, usuário, ação, sessão); esta corta o
 * TEMPO, com um marcador que sabe quando o deploy subiu, coisa que data não
 * sabe. O marcador é `llm_usage_events.app_version`, carimbado pelo build a
 * partir do `package.json`, e ele só separa alguma coisa se a versão SUBIR a
 * cada entrega: é para isso que existe `npm run release`.
 *
 * **A leitura correta é uma ROTA de cada vez**, e o aviso no topo diz isso
 * porque a armadilha é silenciosa: sem fixar a rota, o custo médio por chamada
 * de uma versão muda só porque a MISTURA de rotas mudou entre dois deploys,
 * uma semana com mais estudos gerados parece "a 0.6.0 encareceu tudo".
 *
 * O custo sai por MIL chamadas pela mesma razão que o custo por moeda sai por
 * milheiro (ver `lib/fx/format.ts`): uma chamada custa na casa do milésimo de
 * real, e em duas casas decimais todas as versões empatariam em "R$ 0,00",
 * justamente a diferença que esta tabela existe para mostrar.
 */

/**
 * Amostra abaixo da qual uma variação percentual é ruído com cara de sinal.
 * Duas chamadas caras numa versão recém-subida produzem "+340%" em vermelho, e
 * esse vermelho é lido como regressão, quando o que ele diz é "ainda não deu
 * tempo de medir".
 */
const THIN_SAMPLE_EVENTS = 20;

export function VersoesTab({
  summary,
  money,
  filteredRoute,
}: {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
  filteredRoute: string;
}) {
  const rows = summary.byVersion;

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Por versão</SectionLabel>
      <p className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
        {filteredRoute ? (
          <>
            Comparando a rota <span className="font-mono">{filteredRoute}</span> versão a versão,
            que é como esta tabela se lê.
          </>
        ) : (
          <>
            <strong className="font-semibold text-scriba-ink">
              Filtre uma rota antes de concluir
            </strong>{" "}
            qualquer coisa daqui: sem isso, o custo médio por chamada muda quando a MISTURA de rotas
            muda entre dois deploys, e uma semana com mais estudos gerados parece uma versão que
            encareceu.
          </>
        )}
      </p>
      {rows.length === 0 ? (
        <p className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          Nenhuma chamada no período. Sem evento não há versão para comparar.
        </p>
      ) : null}
      {rows.length === 1 ? (
        <p className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
          Só uma versão gravou chamadas no período. A comparação começa a existir no próximo{" "}
          <span className="font-mono">npm run release</span>.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className={TABLE_SURFACE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>No ar</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right" title="Custo total ÷ chamadas × 1.000">
                  Por 1.000 chamadas
                </TableHead>
                <TableHead className="text-right">Latência média</TableHead>
                <TableHead className="text-right" title="Entrada + saída, só nas chamadas de chat">
                  Tokens/chamada
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <VersionRow
                  key={row.version ?? "__none__"}
                  row={row}
                  previous={rows[index + 1]}
                  money={money}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}

function VersionRow({
  row,
  previous,
  money,
}: {
  row: UsageByVersion;
  previous: UsageByVersion | undefined;
  money: MoneyFormatter;
}) {
  const thin = row.events < THIN_SAMPLE_EVENTS || (previous?.events ?? 0) < THIN_SAMPLE_EVENTS;
  return (
    <TableRow>
      <TableCell>
        {row.version ? (
          <span className="font-mono text-xs font-semibold text-scriba-ink-strong">
            v{row.version}
          </span>
        ) : (
          <span
            className="text-[12px] font-light text-scriba-ink-mute"
            title="Chamadas anteriores à migração 0044. Não há como saber que código as produziu, e chutar mentiria justamente na comparação."
          >
            Antes da medição
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className="block whitespace-nowrap text-[11.5px] text-scriba-ink">
          {moment(row.firstSeen)}
        </span>
        <span className="block whitespace-nowrap text-[10.5px] font-light text-scriba-ink-mute">
          até {moment(row.lastSeen)}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{INT.format(row.events)}</TableCell>
      <TableCell className="text-right font-mono text-xs">
        {money(row.totalCostUsd, "fine")}
      </TableCell>
      <TableCell className="text-right">
        <span className="block font-mono text-xs text-scriba-ink">
          {money(row.costPerEventUsd * 1000, "fine")}
        </span>
        <Delta value={row.costPerEventDelta} thin={thin} />
      </TableCell>
      <TableCell className="text-right">
        <span className="block font-mono text-xs text-scriba-ink">{latency(row.avgLatencyMs)}</span>
        <Delta value={row.latencyDelta} thin={thin} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
        {row.avgTokensPerChatEvent == null
          ? "-"
          : INT.format(Math.round(row.avgTokensPerChatEvent))}
      </TableCell>
    </TableRow>
  );
}

/**
 * A variação contra a versão anterior. Subir é PIOR nas duas métricas em que
 * ela aparece (custo e latência), então uma cor só basta: rosa marca a piora,
 * menta marca a melhora. Empate técnico (menos de 1%) sai neutro, pintar meio
 * ponto percentual acenderia a coluna inteira, e aí nenhuma linha chama
 * atenção.
 */
function Delta({ value, thin }: { value: number | null; thin: boolean }) {
  if (value == null) return <span className="text-[11px] text-scriba-ink-mute">-</span>;
  const pct = `${value > 0 ? "+" : "−"}${(Math.abs(value) * 100).toFixed(1).replace(".", ",")}%`;
  if (thin) {
    return (
      <span
        className="text-[11px] font-light text-scriba-ink-mute"
        title={`Menos de ${THIN_SAMPLE_EVENTS} chamadas de um dos lados, amostra fina demais para concluir.`}
      >
        {pct}
      </span>
    );
  }
  const tone =
    Math.abs(value) < 0.01
      ? "text-scriba-ink-mute"
      : value > 0
        ? "text-scriba-rose-accent"
        : "text-scriba-mint-accent";
  return <span className={cn("text-[11px] font-semibold tabular-nums", tone)}>{pct}</span>;
}
