"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CADENCE_LABELS,
  type FinanceCategory,
  type FinanceRecurring,
  NATURE_LABELS,
} from "@/lib/domain/finance";
import type { RecurringSummary } from "@/lib/finance/aggregate";
import { formatBrlCents, formatNativeCents } from "@/lib/finance/money";
import { formatDate } from "./EntriesManager";
import { RecurringDialog } from "./RecurringDialog";

/**
 * A tabela de custos recorrentes (§8).
 *
 * As colunas são o pedido da especificação e cada uma responde uma pergunta
 * diferente: o valor por cobrança é o que sai do banco no dia; o equivalente
 * MENSAL é a régua que permite somar um domínio anual com uma hospedagem
 * mensal; o ANUAL é o compromisso do ano inteiro; a próxima cobrança é a data
 * em que aquele valor some da conta.
 *
 * Cancelados continuam na lista, embaixo e apagados. Tirá-los da tela faria a
 * pergunta "o que a gente cortou e quanto isso economizou?" não ter onde ser
 * respondida, e essa é uma das poucas perguntas em que um painel financeiro
 * de fato ajuda a decidir.
 */

type Props = {
  recurring: FinanceRecurring[];
  summaries: RecurringSummary[];
  categories: FinanceCategory[];
};

export function RecurringManager({ recurring, summaries, categories }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<FinanceRecurring | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const summaryById = new Map(summaries.map((s) => [s.id, s]));
  const active = recurring.filter((r) => r.status === "active");
  const cancelled = recurring.filter((r) => r.status === "cancelled");

  async function handleDelete(item: FinanceRecurring) {
    if (
      !window.confirm(
        `Excluir "${item.description}"? As faturas já lançadas continuam no histórico, só perdem o vínculo. Para parar o custo sem perder o contrato, use "Cancelado".`
      )
    ) {
      return;
    }
    setDeleting(item.id);
    try {
      const res = await fetch(`/api/admin/finance/recurring/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Contrato excluído.");
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao excluir: ${(err as Error).message}`);
    } finally {
      setDeleting(null);
    }
  }

  function renderRows(items: FinanceRecurring[], muted: boolean) {
    return items.map((item) => {
      const summary = summaryById.get(item.id);
      return (
        <TableRow key={item.id} className={muted ? "opacity-55" : undefined}>
          <TableCell>
            <span className="block text-[13px] font-medium text-scriba-ink-strong">
              {item.description}
            </span>
            <span className="block text-[11.5px] font-light text-scriba-ink-mute">
              {item.counterparty ?? summary?.categoryName ?? "-"}
              {summary ? ` · ${NATURE_LABELS[summary.nature]}` : ""}
            </span>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="whitespace-nowrap">
              {CADENCE_LABELS[item.cadence]}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-xs text-scriba-ink">
            {formatNativeCents(item.amountCents, item.currency)}
          </TableCell>
          <TableCell className="text-right font-mono text-xs font-semibold text-scriba-ink-strong">
            {formatBrlCents(summary?.monthlyEquivalentCents ?? null)}
          </TableCell>
          <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
            {formatBrlCents(summary?.annualEquivalentCents ?? null)}
          </TableCell>
          <TableCell className="whitespace-nowrap text-right font-mono text-xs text-scriba-ink-soft">
            {summary?.nextChargeDate ? formatDate(summary.nextChargeDate) : "-"}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Editar"
                onClick={() => setEditing(item)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Excluir"
                disabled={deleting === item.id}
                onClick={() => handleDelete(item)}
              >
                <Trash2 className="size-4 text-scriba-rose-accent" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Novo custo recorrente
        </Button>
      </div>

      {recurring.length === 0 ? (
        <p className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-8 text-center text-sm font-light text-scriba-ink-mute">
          Nenhum custo recorrente cadastrado. Enquanto esta lista estiver vazia, a única despesa que
          o painel enxerga é a de IA, e ela é medida, não lançada.
        </p>
      ) : (
        <div className="admin-table admin-card-surface overflow-hidden rounded-2xl border border-scriba-hairline-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cadência</TableHead>
                <TableHead className="text-right">Por cobrança</TableHead>
                <TableHead className="text-right" title="Rateado pelos meses que a cobrança cobre">
                  Equivalente mensal
                </TableHead>
                <TableHead className="text-right">Equivalente anual</TableHead>
                <TableHead className="text-right">Próxima cobrança</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderRows(active, false)}
              {cancelled.length > 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="bg-scriba-surface text-[11px] font-semibold uppercase tracking-[0.1em] text-scriba-ink-mute"
                  >
                    Cancelados, fora dos totais, mantidos para comparação
                  </TableCell>
                </TableRow>
              ) : null}
              {renderRows(cancelled, true)}
            </TableBody>
          </Table>
        </div>
      )}

      {creating || editing ? (
        <RecurringDialog
          recurring={editing}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
