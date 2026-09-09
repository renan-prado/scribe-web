"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FinanceSettings } from "@/lib/domain/finance";
import { MoneyInput, PercentInput } from "./MoneyInput";

/**
 * Os fatos da empresa que não são lançamento.
 *
 * SALDO EM CAIXA é o que transforma burn rate em RUNWAY. Sem ele, o painel
 * sabe dizer quanto o Scriba queima por mês e não sabe dizer por quanto tempo
 * aguenta — que é a única das duas perguntas que muda uma decisão. É digitado
 * porque não temos integração bancária, e a data ao lado existe para o painel
 * conseguir dizer há quanto tempo o número não é conferido: um saldo de três
 * meses atrás lido como se fosse de hoje é pior que saldo nenhum.
 *
 * CÂMBIO DAS PROJEÇÕES é separado do câmbio vivo de `lib/fx/usd-brl.ts` de
 * propósito. O vivo converte o histórico e as dívidas; este fixa a hipótese de
 * doze meses. Sem a separação, uma projeção mudaria de resultado entre dois
 * carregamentos da mesma página porque o dólar mexeu — e a leitura seria "a
 * conta está instável", não "o dólar subiu".
 */

export function FinanceSettingsForm({ settings }: { settings: FinanceSettings }) {
  const router = useRouter();
  const [cashBalanceCents, setCashBalanceCents] = useState<number | null>(
    settings.cashBalanceCents
  );
  const [cashBalanceAt, setCashBalanceAt] = useState(settings.cashBalanceAt ?? "");
  const [taxBps, setTaxBps] = useState<number | null>(settings.taxBps);
  const [projectionFx, setProjectionFx] = useState(
    settings.projectionUsdBrl === null ? "" : String(settings.projectionUsdBrl)
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const fx = projectionFx.trim()
      ? Number.parseFloat(projectionFx.trim().replace(",", "."))
      : null;
    if (fx !== null && (!Number.isFinite(fx) || fx <= 0)) {
      toast.error("Câmbio inválido.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/finance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashBalanceCents: cashBalanceCents ?? 0,
          cashBalanceAt: cashBalanceAt || null,
          taxBps: taxBps ?? 0,
          projectionUsdBrl: fx,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      toast.success("Configurações salvas.");
      router.refresh();
    } catch (err) {
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
      <div>
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">Parâmetros financeiros</h2>
        <p className="text-[12px] font-light text-scriba-ink-mute">
          Valem para todo mundo que abrir o painel — não são preferência de navegador.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Saldo em caixa"
          htmlFor="set-cash"
          hint="É o que transforma burn rate em runway."
        >
          <MoneyInput
            id="set-cash"
            valueCents={cashBalanceCents}
            currency="BRL"
            onChange={setCashBalanceCents}
          />
        </Field>
        <Field
          label="Conferido em"
          htmlFor="set-cash-at"
          hint="Para o painel poder dizer há quanto tempo este número não é atualizado."
        >
          <Input
            id="set-cash-at"
            type="date"
            value={cashBalanceAt}
            onChange={(e) => setCashBalanceAt(e.target.value)}
          />
        </Field>
        <Field
          label="Alíquota efetiva sobre a receita"
          htmlFor="set-tax"
          hint="Usada no lucro líquido e nas projeções. Zero deixa o painel mostrando só o lucro bruto."
        >
          <PercentInput id="set-tax" valueBps={taxBps} onChange={setTaxBps} />
        </Field>
        <Field
          label="Câmbio das projeções (USD → BRL)"
          htmlFor="set-fx"
          hint="Em branco usa a cotação viva. Fixar evita que uma projeção de 12 meses mude de resultado entre dois carregamentos."
        >
          <Input
            id="set-fx"
            inputMode="decimal"
            value={projectionFx}
            onChange={(e) => setProjectionFx(e.target.value)}
            placeholder="Cotação viva"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </section>
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
