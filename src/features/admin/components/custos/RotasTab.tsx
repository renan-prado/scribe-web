import { CoinMark } from "@/components/icons/CoinMark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUsageSummary } from "@/features/admin/server/db/usage";
import type { MoneyFormatter } from "@/lib/fx/format";
import { INT, TABLE_SURFACE } from "./format";
import { SectionLabel } from "./notices";

/**
 * O corte de ESPAÇO: para onde o dinheiro foi, por rota e por pessoa.
 *
 * É a aba do diagnóstico, e não a da decisão: uma rota cara diz que vale
 * trocar de modelo ou encurtar um prompt, e é a aba de preços que diz se o que
 * se cobra por ela ainda fecha.
 */
export function RotasTab({
  summary,
  money,
}: {
  summary: AdminUsageSummary;
  money: MoneyFormatter;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <SectionLabel>Por rota</SectionLabel>
        <div className={TABLE_SURFACE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byRoute.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Sem eventos.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byRoute.map((r) => (
                  <TableRow key={r.route}>
                    <TableCell className="font-mono text-xs text-scriba-ink">{r.route}</TableCell>
                    <TableCell className="text-right">{INT.format(r.events)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {money(r.totalCostUsd, "fine")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Por usuário</SectionLabel>
        <div className={TABLE_SURFACE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                {/* A ordenação vem por MOEDAS, não por dólar: dólar mistura
                    modelos de preços diferentes, e a lista deixava de
                    responder a pergunta que ela existe para responder. */}
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <CoinMark size={14} /> Moedas
                  </span>
                </TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Sem eventos.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byUser.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-scriba-ink">
                          {u.displayName?.trim() || u.email || u.userId.slice(0, 8)}
                        </span>
                        {u.email ? (
                          <span className="text-[0.7rem] text-scriba-ink-mute">{u.email}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {u.totalCoins > 0 ? INT.format(u.totalCoins) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{INT.format(u.events)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {money(u.totalCostUsd, "fine")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
