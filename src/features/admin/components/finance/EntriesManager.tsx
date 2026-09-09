"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type EntryStatus,
  entryStatusLabel,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceKind,
  type FinanceRecurring,
} from "@/lib/domain/finance";
import { entryAmountBrlCents, formatBrlCents, formatNativeCents } from "@/lib/finance/money";
import { EntryDialog } from "./EntryDialog";

/**
 * A lista de lançamentos com os filtros do §17.
 *
 * O FILTRO É CLIENTE, e é uma decisão de tamanho: a tela recebe todos os
 * lançamentos do servidor e recorta em memória. Enquanto isto for um controle
 * financeiro interno de uma empresa pequena — dezenas de lançamentos por mês —
 * um round-trip por mudança de filtro custaria mais em latência do que economiza
 * em dados. O dia em que a lista passar de alguns milhares de linhas, a rota
 * `GET /api/admin/finance/entries` já aceita os mesmos filtros: é trocar o
 * `useMemo` por um fetch, sem mexer no resto.
 *
 * A coluna de valor mostra os DOIS números quando a moeda não é o real: o
 * original ("US$ 500") e o convertido. Só o convertido faria quem lançou não
 * reconhecer o próprio lançamento; só o original impediria comparar linhas.
 */

type Props = {
  entries: FinanceEntry[];
  categories: FinanceCategory[];
  recurring: FinanceRecurring[];
  usdBrl: number | null;
};

const ALL = "all";

const KIND_FILTER: SelectOption[] = [
  { value: ALL, label: "Receitas e despesas" },
  { value: "revenue", label: "Só receitas" },
  { value: "expense", label: "Só despesas" },
];

const STATUS_FILTER: SelectOption[] = [
  { value: ALL, label: "Qualquer situação" },
  { value: "paid", label: "Liquidado" },
  { value: "pending", label: "Pendente" },
  { value: "planned", label: "Previsto" },
];

const CURRENCY_FILTER: SelectOption[] = [
  { value: ALL, label: "Qualquer moeda" },
  { value: "BRL", label: "Real" },
  { value: "USD", label: "Dólar" },
];

export function EntriesManager({ entries, categories, recurring, usdBrl }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [currency, setCurrency] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const categoryFilter: SelectOption[] = [
    { value: ALL, label: "Todas as categorias" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kind !== ALL && e.kind !== kind) return false;
      if (status !== ALL && e.status !== status) return false;
      if (categoryId !== ALL && e.categoryId !== categoryId) return false;
      if (currency !== ALL && e.currency !== currency) return false;
      if (from && e.competenceDate < from) return false;
      if (to && e.competenceDate > to) return false;
      if (term) {
        const haystack = `${e.description} ${e.counterparty ?? ""} ${e.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [entries, search, kind, status, categoryId, currency, from, to]);

  // O total do RECORTE, e não da base: é o que responde "quanto gastamos com
  // IA nos últimos 6 meses?" sem exigir uma tela nova para cada pergunta.
  const totals = useMemo(() => {
    let revenue = 0;
    let expense = 0;
    let unconvertible = 0;
    for (const e of filtered) {
      const brl = entryAmountBrlCents(e, { usdBrl });
      if (brl === null) {
        unconvertible += 1;
        continue;
      }
      if (e.kind === "revenue") revenue += brl;
      else expense += brl;
    }
    return { revenue, expense, unconvertible };
  }, [filtered, usdBrl]);

  async function handleDelete(entry: FinanceEntry) {
    // `confirm` nativo e não um diálogo próprio: a ação é destrutiva e rara, e
    // o que ela precisa é de uma barreira, não de desenho.
    if (!window.confirm(`Excluir "${entry.description}"? Isso não pode ser desfeito.`)) return;
    setDeleting(entry.id);
    try {
      const res = await fetch(`/api/admin/finance/entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Lançamento excluído.");
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao excluir: ${(err as Error).message}`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição, fornecedor ou observação"
            className="xl:col-span-2"
          />
          <FilterSelect items={KIND_FILTER} value={kind} onChange={setKind} />
          <FilterSelect items={STATUS_FILTER} value={status} onChange={setStatus} />
          <FilterSelect items={categoryFilter} value={categoryId} onChange={setCategoryId} />
          <FilterSelect items={CURRENCY_FILTER} value={currency} onChange={setCurrency} />
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="De"
          />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-scriba-hairline pt-3">
          <p className="text-[12px] font-light text-scriba-ink-soft">
            {filtered.length} lançamento(s) · receitas{" "}
            <strong className="font-mono font-semibold text-scriba-mint-accent">
              {formatBrlCents(totals.revenue)}
            </strong>{" "}
            · despesas{" "}
            <strong className="font-mono font-semibold text-scriba-rose-accent">
              {formatBrlCents(totals.expense)}
            </strong>
            {totals.unconvertible > 0
              ? ` · ${totals.unconvertible} fora do total por falta de cotação`
              : ""}
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo lançamento
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-8 text-center text-sm font-light text-scriba-ink-mute">
          {entries.length === 0
            ? "Nenhum lançamento cadastrado ainda. Comece pelos custos recorrentes — eles respondem sozinhos quanto o Scriba custa por mês."
            : "Nenhum lançamento corresponde aos filtros."}
        </p>
      ) : (
        <div className="admin-table admin-card-surface overflow-hidden rounded-2xl border border-scriba-hairline-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const brl = entryAmountBrlCents(entry, { usdBrl });
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-scriba-ink-soft">
                      {formatDate(entry.competenceDate)}
                    </TableCell>
                    <TableCell>
                      <span className="block text-[13px] font-medium text-scriba-ink-strong">
                        {entry.description}
                      </span>
                      {entry.counterparty ? (
                        <span className="block text-[11.5px] font-light text-scriba-ink-mute">
                          {entry.counterparty}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-scriba-ink-soft">
                      {entry.categoryId ? (categoryName.get(entry.categoryId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} kind={entry.kind} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          entry.kind === "revenue"
                            ? "block font-mono text-xs font-semibold text-scriba-mint-accent"
                            : "block font-mono text-xs font-semibold text-scriba-ink-strong"
                        }
                      >
                        {entry.kind === "revenue" ? "+" : "−"}
                        {formatBrlCents(brl)}
                      </span>
                      {entry.currency !== "BRL" ? (
                        <span className="block font-mono text-[10.5px] font-light text-scriba-ink-mute">
                          {formatNativeCents(entry.amountCents, entry.currency)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar"
                          onClick={() => setEditing(entry)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir"
                          disabled={deleting === entry.id}
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="size-4 text-scriba-rose-accent" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {creating || editing ? (
        <EntryDialog
          entry={editing}
          categories={categories}
          recurring={recurring}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  items,
  value,
  onChange,
}: {
  items: SelectOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusBadge({ status, kind }: { status: EntryStatus; kind: FinanceKind }) {
  // Liquidado é a pastilha DISCRETA e pendente é a que puxa o olho: numa lista
  // de lançamentos, o que exige ação é o que ainda se deve. Destacar o que já
  // está resolvido faria a tela inteira brilhar e nada chamar atenção.
  const variant =
    status === "paid" ? "secondary" : status === "pending" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {entryStatusLabel(status, kind)}
    </Badge>
  );
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}
