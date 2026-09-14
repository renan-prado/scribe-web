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
import { CopyButton } from "@/features/admin/components/CopyButton";
import { SessionModeBadge } from "@/features/admin/components/SessionModeBadge";
import type { AdminUsageSummary } from "@/features/admin/server/db/usage";
import type { CostPerThousandCoinsFormatter, MoneyFormatter } from "@/lib/fx/format";
import { duration, INT, moment, TABLE_SURFACE } from "./format";
import { SectionLabel } from "./notices";

/**
 * O custo de cada sessão, e a porta para abrir uma delas execução por
 * execução.
 *
 * As duas coisas ficaram na MESMA aba de propósito. Enquanto eram duas telas,
 * a tabela morava em "Uso & custos" e o inspetor de execuções em
 * "Precificação", os dois governados por um `sessionId` na URL com o mesmo
 * nome e significados diferentes: lá ele filtrava a tabela, aqui ele abria a
 * sessão. Juntos, o parâmetro passa a querer dizer uma coisa só, "esta
 * sessão", e o clique na linha entrega o agregado e as execuções de uma vez.
 */
export function SessoesTab({
  summary,
  money,
  costPerThousandCoins,
  sessionHref,
}: {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
  costPerThousandCoins: CostPerThousandCoinsFormatter;
  /** O link que fixa uma sessão sem perder período, versão e os demais filtros. */
  sessionHref: (sessionId: string) => string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Sessões</SectionLabel>
      <div className={TABLE_SURFACE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sessão</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead className="text-right">Duração</TableHead>
              <TableHead className="text-right">Chamadas</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Moedas
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <CoinMark size={14} /> Por 1.000
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.bySession.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão com eventos.
                </TableCell>
              </TableRow>
            ) : (
              summary.bySession.map((s) => (
                <TableRow key={s.sessionId} className="group">
                  <TableCell>
                    <Link
                      className="flex flex-col text-scriba-ink transition-colors hover:text-scriba-blue-ink"
                      href={sessionHref(s.sessionId)}
                      title="Abrir esta sessão execução por execução"
                    >
                      <span className="truncate font-medium">
                        {s.title?.trim() || "Sessão sem título"}
                      </span>
                      <span className="text-[0.7rem] font-light text-scriba-ink-mute">
                        {moment(s.createdAt)}
                      </span>
                    </Link>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.65rem] text-scriba-ink-mute/70">
                      {s.sessionId.slice(0, 8)}…
                      <CopyButton value={s.sessionId} />
                      {/* O custo desta linha ao lado do CONTEÚDO que ele
                          pagou. O título já leva ao recorte por sessão desta
                          mesma tela, então a leitura precisa de porta
                          própria. */}
                      <Link
                        href={`/admin/sessions/${s.sessionId}`}
                        className="font-sans text-[0.7rem] font-medium text-scriba-ink-mute hover:text-scriba-ink hover:underline"
                      >
                        ler
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.ownerDisplayName || (s.userId ? s.userId.slice(0, 8) : "-")}
                  </TableCell>
                  <TableCell>
                    <SessionModeBadge mode={s.mode} />
                  </TableCell>
                  <TableCell className="text-right">{duration(s.durationMs)}</TableCell>
                  <TableCell className="text-right">{INT.format(s.events)}</TableCell>
                  <TableCell className="text-right">{money(s.totalCostUsd, "fine")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.coins > 0 ? INT.format(s.coins) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {costPerThousandCoins(s.costPerCoinUsd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
