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
import type { FinanceScenario } from "@/lib/domain/finance";
import { formatBrlCents } from "@/lib/finance/money";
import { MoneyInput, PercentInput } from "./MoneyInput";

/**
 * As premissas de um cenário.
 *
 * Três campos são OPCIONAIS de propósito, e o vazio deles significa "use o
 * medido": ticket (usa o ARPU real), alíquota (herda das configurações) e
 * custo fixo extra (soma zero). Preencher os três transformaria o cenário
 * numa planilha desconectada da realidade do produto, que é exatamente o que
 * a projeção deste painel existe para não ser.
 */

type Props = {
  scenario: FinanceScenario | null;
  /** Mostrado como legenda do campo de ticket quando ele fica em branco. */
  measuredArpuCents: number;
  onClose: () => void;
};

export function ScenarioDialog({ scenario, measuredArpuCents, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState(scenario?.name ?? "");
  const [growthBps, setGrowthBps] = useState<number | null>(scenario?.growthBps ?? 0);
  const [churnBps, setChurnBps] = useState<number | null>(scenario?.churnBps ?? 0);
  const [newCustomers, setNewCustomers] = useState(String(scenario?.newCustomersPerMonth ?? 0));
  const [ticketCents, setTicketCents] = useState<number | null>(scenario?.ticketCents ?? null);
  const [extraFixedCents, setExtraFixedCents] = useState<number | null>(
    scenario?.extraFixedCostCents ?? 0
  );
  const [taxBps, setTaxBps] = useState<number | null>(scenario?.taxBps ?? null);
  const [horizon, setHorizon] = useState(String(scenario?.horizonMonths ?? 12));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Dê um nome ao cenário.");
      return;
    }
    const horizonMonths = Number.parseInt(horizon, 10);
    if (!Number.isFinite(horizonMonths) || horizonMonths < 1 || horizonMonths > 60) {
      toast.error("O horizonte precisa estar entre 1 e 60 meses.");
      return;
    }

    const body = {
      name: name.trim(),
      growthBps: growthBps ?? 0,
      churnBps: Math.max(0, churnBps ?? 0),
      newCustomersPerMonth: Math.max(0, Number.parseInt(newCustomers, 10) || 0),
      ticketCents,
      extraFixedCostCents: extraFixedCents ?? 0,
      taxBps,
      horizonMonths,
    };

    setSaving(true);
    try {
      const res = await fetch(
        scenario ? `/api/admin/finance/scenarios/${scenario.id}` : "/api/admin/finance/scenarios",
        {
          method: scenario ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      toast.success(scenario ? "Cenário atualizado." : "Cenário criado.");
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
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{scenario ? "Editar cenário" : "Novo cenário"}</DialogTitle>
          <DialogDescription>
            Só as premissas ficam gravadas. O resultado é recalculado toda vez, sobre a base medida
            de hoje.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Nome" htmlFor="sc-name">
            <Input
              id="sc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Base"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Crescimento mensal"
              htmlFor="sc-growth"
              hint="Novos clientes como % da base do mês anterior."
            >
              <PercentInput id="sc-growth" valueBps={growthBps} onChange={setGrowthBps} />
            </Field>
            <Field label="Churn mensal" htmlFor="sc-churn" hint="% da base que cancela por mês.">
              <PercentInput id="sc-churn" valueBps={churnBps} onChange={setChurnBps} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Novos clientes por mês"
              htmlFor="sc-new"
              hint="Aquisição absoluta, somada à percentual. Uma campanha traz N pessoas, não N%."
            >
              <Input
                id="sc-new"
                inputMode="numeric"
                value={newCustomers}
                onChange={(e) => setNewCustomers(e.target.value)}
              />
            </Field>
            <Field label="Horizonte (meses)" htmlFor="sc-horizon">
              <Input
                id="sc-horizon"
                inputMode="numeric"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Ticket médio"
            htmlFor="sc-ticket"
            hint={`Em branco usa o ARPU medido (${formatBrlCents(measuredArpuCents)}).`}
          >
            <MoneyInput
              id="sc-ticket"
              valueCents={ticketCents}
              currency="BRL"
              onChange={setTicketCents}
              placeholder="Medido"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Custo fixo extra"
              htmlFor="sc-fixed"
              hint="Soma ao custo fixo medido, uma contratação planejada, por exemplo."
            >
              <MoneyInput
                id="sc-fixed"
                valueCents={extraFixedCents}
                currency="BRL"
                onChange={setExtraFixedCents}
              />
            </Field>
            <Field label="Alíquota" htmlFor="sc-tax" hint="Em branco herda a das configurações.">
              <PercentInput
                id="sc-tax"
                valueBps={taxBps}
                onChange={setTaxBps}
                placeholder="Herda"
              />
            </Field>
          </div>
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
