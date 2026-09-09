"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CADENCE_LABELS,
  type Currency,
  type EntryStatus,
  entryStatusLabel,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceKind,
  type FinanceRecurring,
} from "@/lib/domain/finance";
import { MoneyInput } from "./MoneyInput";

/**
 * O formulário de lançamento — criar e editar.
 *
 * Três decisões de forma que não são estéticas:
 *
 * 1. **A data de COMPETÊNCIA é obrigatória e vem primeiro; a de liquidação só
 *    aparece quando o status é liquidado.** São as duas datas que separam os
 *    dois regimes do painel (ver `lib/finance/aggregate.ts`), e pedir as duas
 *    sempre faria a pessoa preencher a mesma coisa em dois campos — que é
 *    exatamente como as duas passam a significar a mesma coisa.
 * 2. **O vínculo com um contrato recorrente é oferecido explicitamente.** É o
 *    que impede a fatura real e a provisão do contrato de somarem no mesmo
 *    mês. Sem o campo, a única forma de evitar a dobra seria não lançar a
 *    fatura — e aí o valor real nunca entraria.
 * 3. **O câmbio só é pedido para dólar JÁ liquidado.** Enquanto pendente, a
 *    conversão usa a cotação viva; congelar antes da hora gravaria a cotação
 *    do dia em que alguém abriu o formulário.
 */

type Props = {
  entry: FinanceEntry | null;
  categories: FinanceCategory[];
  recurring: FinanceRecurring[];
  /** Pré-seleciona o tipo ao criar a partir de uma tela específica. */
  defaultKind?: FinanceKind;
  defaultStatus?: EntryStatus;
  onClose: () => void;
};

const KIND_OPTIONS: SelectOption[] = [
  { value: "expense", label: "Despesa" },
  { value: "revenue", label: "Receita" },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: "BRL", label: "Real (R$)" },
  { value: "USD", label: "Dólar (US$)" },
];

const NONE = "__none__";

export function EntryDialog({
  entry,
  categories,
  recurring,
  defaultKind = "expense",
  defaultStatus = "paid",
  onClose,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<FinanceKind>(entry?.kind ?? defaultKind);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [counterparty, setCounterparty] = useState(entry?.counterparty ?? "");
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? NONE);
  const [amountCents, setAmountCents] = useState<number | null>(entry?.amountCents ?? null);
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? "BRL");
  const [fxRate, setFxRate] = useState(entry?.fxRate ? String(entry.fxRate) : "");
  const [paidCents, setPaidCents] = useState<number | null>(entry?.paidCents ?? 0);
  const [status, setStatus] = useState<EntryStatus>(entry?.status ?? defaultStatus);
  const [competenceDate, setCompetenceDate] = useState(entry?.competenceDate ?? todayIso());
  const [dueDate, setDueDate] = useState(entry?.dueDate ?? "");
  const [settledAt, setSettledAt] = useState(entry?.settledAt ?? "");
  const [recurringId, setRecurringId] = useState(entry?.recurringId ?? NONE);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const statusOptions: SelectOption[] = (["paid", "pending", "planned"] as const).map((s) => ({
    value: s,
    label: entryStatusLabel(s, kind),
  }));

  const categoryOptions: SelectOption[] = [
    { value: NONE, label: "Sem categoria" },
    ...categories
      .filter((c) => !c.archivedAt && (c.kind === kind || c.kind === "both"))
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const recurringOptions: SelectOption[] = [
    { value: NONE, label: "Nenhum" },
    ...recurring
      .filter((r) => r.kind === kind)
      .map((r) => ({
        value: r.id,
        label: `${r.description} · ${CADENCE_LABELS[r.cadence]}`,
      })),
  ];

  async function handleSave() {
    if (!description.trim()) {
      toast.error("Informe uma descrição.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (status === "paid" && paidCents !== null && paidCents > amountCents) {
      toast.error("O valor pago não pode superar o valor do lançamento.");
      return;
    }

    const body = {
      kind,
      description: description.trim(),
      counterparty: counterparty.trim() || null,
      categoryId: categoryId === NONE ? null : categoryId,
      amountCents,
      currency,
      fxRate: status === "paid" && currency === "USD" ? parseRate(fxRate) : null,
      paidCents: status === "paid" ? amountCents : (paidCents ?? 0),
      status,
      competenceDate,
      dueDate: dueDate || null,
      settledAt: status === "paid" ? settledAt || competenceDate : null,
      recurringId: recurringId === NONE ? null : recurringId,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch(
        entry ? `/api/admin/finance/entries/${entry.id}` : "/api/admin/finance/entries",
        {
          method: entry ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      toast.success(entry ? "Lançamento atualizado." : "Lançamento criado.");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            A data de competência diz a que mês o valor pertence; a de liquidação, quando o dinheiro
            se moveu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select
                items={KIND_OPTIONS}
                value={kind}
                onValueChange={(v) => {
                  setKind(v as FinanceKind);
                  setCategoryId(NONE);
                  setRecurringId(NONE);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Situação">
              <Select
                items={statusOptions}
                value={status}
                onValueChange={(v) => setStatus(v as EntryStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Descrição" htmlFor="fin-desc">
            <Input
              id="fin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Fatura da Vercel"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={kind === "expense" ? "Fornecedor / credor" : "Origem"} htmlFor="fin-cp">
              <Input
                id="fin-cp"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Ex.: Vercel Inc."
              />
            </Field>

            <Field label="Categoria">
              <Select
                items={categoryOptions}
                value={categoryId}
                onValueChange={(v) => setCategoryId(v ?? NONE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Moeda">
              <Select
                items={CURRENCY_OPTIONS}
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Valor" htmlFor="fin-amount">
              <MoneyInput
                id="fin-amount"
                valueCents={amountCents}
                currency={currency}
                onChange={setAmountCents}
              />
            </Field>
          </div>

          {/* O câmbio só existe para dólar já liquidado — ver o cabeçalho. */}
          {currency === "USD" && status === "paid" ? (
            <Field
              label="Câmbio do dia (USD → BRL)"
              htmlFor="fin-fx"
              hint="Deixe em branco para usar a cotação atual. Uma vez preenchido, este valor congela: a despesa custou o que custou."
            >
              <Input
                id="fin-fx"
                inputMode="decimal"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                placeholder="5,42"
              />
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Competência" htmlFor="fin-comp" hint="A que mês este valor pertence.">
              <Input
                id="fin-comp"
                type="date"
                value={competenceDate}
                onChange={(e) => setCompetenceDate(e.target.value)}
              />
            </Field>

            {status === "paid" ? (
              <Field
                label="Liquidação"
                htmlFor="fin-settled"
                hint="Quando o dinheiro se moveu. Em branco = a data de competência."
              >
                <Input
                  id="fin-settled"
                  type="date"
                  value={settledAt}
                  onChange={(e) => setSettledAt(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Vencimento" htmlFor="fin-due">
                <Input
                  id="fin-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            )}
          </div>

          {/* Pagamento parcial só faz sentido no que ainda não foi liquidado. */}
          {status !== "paid" ? (
            <Field
              label="Já pago (parcial)"
              htmlFor="fin-paid"
              hint="O que ainda se deve é o valor menos isto."
            >
              <MoneyInput
                id="fin-paid"
                valueCents={paidCents}
                currency={currency}
                onChange={setPaidCents}
              />
            </Field>
          ) : null}

          {recurringOptions.length > 1 ? (
            <Field
              label="Fatura de um contrato recorrente"
              hint="Vinculado, este lançamento SUBSTITUI a provisão do contrato no mês — sem isso o custo conta duas vezes."
            >
              <Select
                items={recurringOptions}
                value={recurringId}
                onValueChange={(v) => setRecurringId(v ?? NONE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recurringOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Observações" htmlFor="fin-notes">
            <Input
              id="fin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-[11px] font-light leading-[1.4] text-scriba-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

function parseRate(text: string): number | null {
  const value = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
