"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EntryStatus,
  FinanceCategory,
  FinanceEntry,
  FinanceKind,
  FinanceRecurring,
} from "@/lib/domain/finance";
import {
  entryAmountBrlCents,
  entryPaidBrlCents,
  entryRemainingBrlCents,
  formatBrlCents,
  formatNativeCents,
} from "@/lib/finance/money";
import { formatDate, StatusBadge } from "./EntriesManager";
import { EntryDialog } from "./EntryDialog";

/**
 * Compromissos e dívidas (§9).
 *
 * DÍVIDA NÃO É UM TIPO DE LANÇAMENTO, é um lançamento que ainda não foi
 * liquidado. Esta tela é um RECORTE da mesma tabela, não uma entidade
 * paralela, e a decisão está no cabeçalho da migração 0043: um terceiro tipo
 * daria três somas para o mesmo dinheiro (a despesa, o compromisso e o
 * pagamento dele), e a primeira quitação faria as três discordarem.
 *
 * O que esta tela acrescenta à lista geral são as colunas do §9 que só fazem
 * sentido para o que não foi pago: credor, vencimento, quanto já foi pago e
 * quanto RESTA. A coluna "Resta" é a única que importa para decidir, e por
 * isso é a destacada.
 *
 * O vencido é pintado. É a única coisa pintada nesta tela, e é o motivo dela
 * existir: um passivo em dia é informação; um passivo vencido é uma tarefa.
 */

type Props = {
  entries: FinanceEntry[];
  categories: FinanceCategory[];
  recurring: FinanceRecurring[];
  usdBrl: number | null;
  today: string;
  /** Comissões de parceiro devidas, medidas, não lançadas. Ver a nota abaixo. */
  partnerOwedCents: number;
};

export function CommitmentsManager({
  entries,
  categories,
  recurring,
  usdBrl,
  today,
  partnerOwedCents,
}: Props) {
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [creating, setCreating] = useState<{ kind: FinanceKind; status: EntryStatus } | null>(null);

  const open = entries
    .filter((e) => e.status !== "paid")
    .sort((a, b) => {
      // Sem vencimento vai para o fim: o que tem data é o que tem prazo.
      if (!a.dueDate && !b.dueDate) return a.competenceDate.localeCompare(b.competenceDate);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const payables = open.filter((e) => e.kind === "expense");
  const receivables = open.filter((e) => e.kind === "revenue");

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="A pagar"
        subtitle="Dívidas e compromissos ainda não liquidados"
        action={
          <Button onClick={() => setCreating({ kind: "expense", status: "pending" })}>
            <Plus className="size-4" />
            Nova dívida
          </Button>
        }
      >
        <CommitmentTable
          entries={payables}
          usdBrl={usdBrl}
          today={today}
          onEdit={setEditing}
          emptyText="Nada a pagar registrado."
        />
        {/* A comissão de parceiro é passivo real e não entra na tabela porque
            não é um lançamento: ela vive em `partner_commissions` e é MEDIDA.
            Mostrá-la aqui como linha editável convidaria alguém a lançá-la à
            mão e contá-la duas vezes. */}
        {partnerOwedCents > 0 ? (
          <p className="rounded-xl bg-scriba-mint px-3.5 py-2.5 text-[12px] font-light text-scriba-mint-ink">
            Além disso, há{" "}
            <strong className="font-mono font-semibold">{formatBrlCents(partnerOwedCents)}</strong>{" "}
            em comissões de parceiro a pagar. Esse valor é <strong>medido</strong> em
            `partner_commissions` e já entra no total de compromissos da visão geral, não o lance
            aqui à mão.
          </p>
        ) : null}
      </Section>

      <Section
        title="A receber"
        subtitle="Receitas firmadas ou previstas que ainda não entraram"
        action={
          <Button
            variant="secondary"
            onClick={() => setCreating({ kind: "revenue", status: "pending" })}
          >
            <Plus className="size-4" />
            Novo a receber
          </Button>
        }
      >
        <CommitmentTable
          entries={receivables}
          usdBrl={usdBrl}
          today={today}
          onEdit={setEditing}
          emptyText="Nada a receber registrado."
        />
      </Section>

      {creating || editing ? (
        <EntryDialog
          entry={editing}
          categories={categories}
          recurring={recurring}
          defaultKind={creating?.kind}
          defaultStatus={creating?.status}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-scriba-ink-strong">{title}</h2>
          <p className="text-[12px] font-light text-scriba-ink-mute">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CommitmentTable({
  entries,
  usdBrl,
  today,
  onEdit,
  emptyText,
}: {
  entries: FinanceEntry[];
  usdBrl: number | null;
  today: string;
  onEdit: (entry: FinanceEntry) => void;
  emptyText: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-6 text-center text-sm font-light text-scriba-ink-mute">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="admin-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Credor / origem</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Já pago</TableHead>
            <TableHead className="text-right">Resta</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const overdue = Boolean(entry.dueDate && entry.dueDate < today);
            return (
              <TableRow key={entry.id}>
                <TableCell>
                  <span className="block text-[13px] font-medium text-scriba-ink-strong">
                    {entry.counterparty ?? entry.description}
                  </span>
                  <span className="block text-[11.5px] font-light text-scriba-ink-mute">
                    {entry.counterparty
                      ? entry.description
                      : `Competência ${formatDate(entry.competenceDate)}`}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={entry.status} kind={entry.kind} />
                </TableCell>
                <TableCell
                  className={
                    overdue
                      ? "whitespace-nowrap font-mono text-xs font-semibold text-scriba-rose-accent"
                      : "whitespace-nowrap font-mono text-xs text-scriba-ink-soft"
                  }
                >
                  {entry.dueDate ? formatDate(entry.dueDate) : "-"}
                  {overdue ? <span className="ml-1.5 font-sans font-normal">vencido</span> : null}
                </TableCell>
                <TableCell className="text-right">
                  <span className="block font-mono text-xs text-scriba-ink">
                    {formatBrlCents(entryAmountBrlCents(entry, { usdBrl }))}
                  </span>
                  {entry.currency !== "BRL" ? (
                    <span className="block font-mono text-[10.5px] font-light text-scriba-ink-mute">
                      {formatNativeCents(entry.amountCents, entry.currency)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-scriba-ink-soft">
                  {formatBrlCents(entryPaidBrlCents(entry, { usdBrl }))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold text-scriba-ink-strong">
                  {formatBrlCents(entryRemainingBrlCents(entry, { usdBrl }))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editar"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
