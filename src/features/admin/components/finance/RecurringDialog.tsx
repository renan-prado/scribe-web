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
  CADENCES,
  type Cadence,
  type Currency,
  type FinanceCategory,
  type FinanceKind,
  type FinanceRecurring,
  type RecurringStatus,
} from "@/lib/domain/finance";
import { formatBrlCents, formatNativeCents } from "@/lib/finance/money";
import { annualEquivalentCents, monthlyEquivalentCents } from "@/lib/finance/recurrence";
import { MoneyInput } from "./MoneyInput";

/**
 * O formulário de contrato recorrente.
 *
 * Ele mostra o EQUIVALENTE MENSAL enquanto se digita, e isso não é enfeite: a
 * pergunta que a tela de recorrentes existe para responder é "quanto o Scriba
 * custa por mês", e um domínio de R$ 80/ano cadastrado sem ver o R$ 6,67 ao
 * lado é um número que ninguém consegue conferir de cabeça na hora.
 *
 * A DATA DE INÍCIO ancora as ocorrências: o dia dela é o dia da cobrança, e o
 * mês dela é o marco a partir do qual a cadência conta. Uma trimestral que
 * começa em fevereiro cobra fev/mai/ago/nov, não jan/abr/jul/out — a legenda
 * do campo diz isso, porque a leitura natural é a do calendário.
 */

type Props = {
  recurring: FinanceRecurring | null;
  categories: FinanceCategory[];
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

const CADENCE_OPTIONS: SelectOption[] = CADENCES.map((c) => ({
  value: c,
  label: CADENCE_LABELS[c],
}));

const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Ativo" },
  { value: "cancelled", label: "Cancelado" },
];

const NONE = "__none__";

export function RecurringDialog({ recurring, categories, onClose }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<FinanceKind>(recurring?.kind ?? "expense");
  const [description, setDescription] = useState(recurring?.description ?? "");
  const [counterparty, setCounterparty] = useState(recurring?.counterparty ?? "");
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? NONE);
  const [amountCents, setAmountCents] = useState<number | null>(recurring?.amountCents ?? null);
  const [currency, setCurrency] = useState<Currency>(recurring?.currency ?? "BRL");
  const [cadence, setCadence] = useState<Cadence>(recurring?.cadence ?? "monthly");
  const [startDate, setStartDate] = useState(recurring?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(recurring?.endDate ?? "");
  const [status, setStatus] = useState<RecurringStatus>(recurring?.status ?? "active");
  const [notes, setNotes] = useState(recurring?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const categoryOptions: SelectOption[] = [
    { value: NONE, label: "Sem categoria" },
    ...categories
      .filter((c) => !c.archivedAt && (c.kind === kind || c.kind === "both"))
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const monthly = amountCents === null ? null : monthlyEquivalentCents(amountCents, cadence);
  const annual = amountCents === null ? null : annualEquivalentCents(amountCents, cadence);

  async function handleSave() {
    if (!description.trim()) {
      toast.error("Informe uma descrição.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (endDate && endDate < startDate) {
      toast.error("O término não pode ser antes do início.");
      return;
    }

    const body = {
      kind,
      description: description.trim(),
      counterparty: counterparty.trim() || null,
      categoryId: categoryId === NONE ? null : categoryId,
      amountCents,
      currency,
      cadence,
      startDate,
      endDate: endDate || null,
      status,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch(
        recurring ? `/api/admin/finance/recurring/${recurring.id}` : "/api/admin/finance/recurring",
        {
          method: recurring ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      toast.success(recurring ? "Contrato atualizado." : "Contrato criado.");
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
          <DialogTitle>{recurring ? "Editar contrato" : "Novo custo recorrente"}</DialogTitle>
          <DialogDescription>
            Um contrato é uma previsão de cobrança, não um fato. Quando a fatura real chegar,
            lance-a em Lançamentos vinculada a este contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <PlainSelect
                items={KIND_OPTIONS}
                value={kind}
                onChange={(v) => {
                  setKind(v as FinanceKind);
                  setCategoryId(NONE);
                }}
              />
            </Field>
            <Field label="Situação">
              <PlainSelect
                items={STATUS_OPTIONS}
                value={status}
                onChange={(v) => setStatus(v as RecurringStatus)}
              />
            </Field>
          </div>

          <Field label="Descrição" htmlFor="rec-desc">
            <Input
              id="rec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Vercel Pro"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fornecedor" htmlFor="rec-cp">
              <Input
                id="rec-cp"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Ex.: Vercel Inc."
              />
            </Field>
            <Field label="Categoria" hint="Ela decide se este custo é fixo ou variável.">
              <PlainSelect items={categoryOptions} value={categoryId} onChange={setCategoryId} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Moeda">
              <PlainSelect
                items={CURRENCY_OPTIONS}
                value={currency}
                onChange={(v) => setCurrency(v as Currency)}
              />
            </Field>
            <Field label="Valor por cobrança" htmlFor="rec-amount">
              <MoneyInput
                id="rec-amount"
                valueCents={amountCents}
                currency={currency}
                onChange={setAmountCents}
              />
            </Field>
            <Field label="Cadência">
              <PlainSelect
                items={CADENCE_OPTIONS}
                value={cadence}
                onChange={(v) => setCadence(v as Cadence)}
              />
            </Field>
          </div>

          {/* O equivalente calculado ao vivo. Ver o cabeçalho do arquivo. */}
          {monthly !== null && annual !== null ? (
            <p className="rounded-xl bg-scriba-surface px-3.5 py-2.5 text-[12px] font-light text-scriba-ink-soft">
              Equivale a{" "}
              <strong className="font-mono font-semibold text-scriba-ink-strong">
                {currency === "BRL"
                  ? formatBrlCents(monthly)
                  : formatNativeCents(monthly, currency)}
              </strong>{" "}
              por mês ·{" "}
              <strong className="font-mono font-semibold text-scriba-ink-strong">
                {currency === "BRL" ? formatBrlCents(annual) : formatNativeCents(annual, currency)}
              </strong>{" "}
              por ano
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Início"
              htmlFor="rec-start"
              hint="O dia é o da cobrança e o mês é o marco da cadência: uma trimestral iniciada em fevereiro cobra fev, mai, ago e nov."
            >
              <Input
                id="rec-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Término" htmlFor="rec-end" hint="Em branco = sem prazo.">
              <Input
                id="rec-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Observações" htmlFor="rec-notes">
            <Input
              id="rec-notes"
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

function PlainSelect({
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
