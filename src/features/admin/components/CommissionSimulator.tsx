"use client";

import { formatBrl, PLANS } from "@/lib/billing/plans";
import {
  ASSUMED_BONUS_USAGE_RATE,
  ASSUMED_CONVERSION_RATE,
  PAYOUT_MINIMUM_CENTS,
  type Simulation,
  simulatePartnerEconomics,
} from "@/lib/partners/economics";
import { cn } from "@/lib/utils";

/**
 * Mostra o efeito de uma taxa de comissão ENQUANTO ela é digitada.
 *
 * Existe porque a taxa é editável por parceiro e pode ser negociada caso a
 * caso. Sem esta tela, a escolha seria às cegas: nada no formulário diria que
 * 70% deixa o primeiro mês negativo, nem que a 20% um parceiro pequeno passa
 * meses sem atingir o mínimo de saque.
 *
 * É AVISO, não bloqueio. Pode haver razão comercial para uma taxa agressiva
 * num parceiro específico — o que não pode é ela ser escolhida sem que a
 * consequência apareça.
 *
 * A conta vem inteira de `lib/partners/economics.ts`, o mesmo módulo que o
 * painel do parceiro e a memória de cálculo do doc usam.
 */

type Props = {
  rateBps: number;
  bonusCoins: number;
  /** Custo medido de 1.000 moedas, em centavos de BRL. Vem do /admin. */
  costPerThousandCoinsCents: number;
  /** Conversão real deste parceiro, quando já houver dados. */
  measuredConversionRate?: number | null;
};

export function CommissionSimulator({
  rateBps,
  bonusCoins,
  costPerThousandCoinsCents,
  measuredConversionRate,
}: Props) {
  const conversionRate = measuredConversionRate ?? ASSUMED_CONVERSION_RATE;
  const measured = measuredConversionRate != null;

  const sims = (["pessoal", "estudioso"] as const).map((plan) => ({
    plan,
    name: PLANS[plan].name,
    priceCents: PLANS[plan].priceCents,
    sim: simulatePartnerEconomics({
      priceCents: PLANS[plan].priceCents,
      planCoins: PLANS[plan].coins,
      rateBps,
      costPerThousandCoinsCents,
      bonusCoins,
      conversionRate,
      bonusUsageRate: ASSUMED_BONUS_USAGE_RATE,
    }),
  }));

  // O aviso segue o cenário PIOR dos dois planos: se o Pessoal fica negativo,
  // a taxa é arriscada mesmo que o Estudioso continue folgado — e é o Pessoal
  // que a maioria assina.
  const worst = sims.reduce((a, b) => (a.sim.month1Cents <= b.sim.month1Cents ? a : b));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-scriba-ink-strong">
          O que essa taxa significa
        </h3>
        <span className="text-[11px] font-light text-scriba-ink-mute">
          {(rateBps / 100).toLocaleString("pt-BR")}% por assinante
        </span>
      </div>

      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.08em] text-scriba-ink-mute">
            <th className="pb-1.5 font-medium">Plano</th>
            <th className="pb-1.5 text-right font-medium">Parceiro</th>
            <th className="pb-1.5 text-right font-medium">Você, mês 1</th>
            <th className="pb-1.5 text-right font-medium">Recorrente</th>
            <th className="pb-1.5 text-right font-medium">Saque</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-scriba-hairline">
          {sims.map(({ plan, name, sim }) => (
            <tr key={plan}>
              <td className="py-2 text-scriba-ink">{name}</td>
              <td className="py-2 text-right font-mono text-[11.5px] text-scriba-ink-strong">
                {formatBrl(sim.partnerCents)}
              </td>
              <td
                className={cn(
                  "py-2 text-right font-mono text-[11.5px] font-semibold",
                  sim.month1Cents < 0 ? "text-scriba-rose-accent" : "text-scriba-ink-strong"
                )}
              >
                {formatBrl(sim.month1Cents)}
              </td>
              <td className="py-2 text-right font-mono text-[11.5px] text-scriba-ink-soft">
                {formatBrl(sim.recurringCents)}/mês
              </td>
              <td className="py-2 text-right font-mono text-[11.5px] text-scriba-ink-soft">
                {sim.conversionsToPayout} conv.
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Verdict sim={worst.sim} planName={worst.name} />

      <p className="text-[11px] font-light leading-[1.5] text-scriba-ink-mute">
        {measured ? (
          <>
            Conversão medida deste parceiro: {(conversionRate * 100).toFixed(1).replace(".", ",")}%.
          </>
        ) : (
          <>
            Premissa de conversão: {ASSUMED_CONVERSION_RATE * 100}% (chute conservador — ainda não
            há dado real deste parceiro).
          </>
        )}{" "}
        Custo de 1.000 moedas: {formatBrl(costPerThousandCoinsCents)}, medido. &quot;Saque&quot; é
        quantos assinantes o parceiro precisa trazer para atingir o mínimo de{" "}
        {formatBrl(PAYOUT_MINIMUM_CENTS)}.
      </p>
    </div>
  );
}

function Verdict({ sim, planName }: { sim: Simulation; planName: string }) {
  if (sim.verdict === "negative") {
    return (
      <Banner tone="negative">
        No <strong className="font-semibold">{planName}</strong> você fica{" "}
        <strong className="font-semibold">{formatBrl(Math.abs(sim.month1Cents))} negativo</strong>{" "}
        no primeiro mês. Recupera em {sim.paybackDays} {sim.paybackDays === 1 ? "dia" : "dias"} do
        mês 2, e a partir dali são {formatBrl(sim.recurringCents)}/mês limpos enquanto a pessoa
        ficar.
      </Banner>
    );
  }
  if (sim.verdict === "thin") {
    return (
      <Banner tone="thin">
        Sobra pouco no primeiro mês do <strong className="font-semibold">{planName}</strong>:{" "}
        {formatBrl(sim.month1Cents)}. Ainda é positivo, mas uma alta do dólar ou do preço do modelo
        empurra para o vermelho.
      </Banner>
    );
  }
  return (
    <Banner tone="healthy">
      Positivo já no primeiro mês, com {formatBrl(sim.month1Cents)} de folga no{" "}
      {planName.toLowerCase()}.
    </Banner>
  );
}

const TONES = {
  healthy: "bg-scriba-mint text-scriba-mint-body",
  thin: "bg-scriba-cream text-scriba-cream-body",
  negative: "bg-scriba-rose text-scriba-rose-ink",
} as const;

function Banner({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <p className={cn("rounded-xl px-3 py-2 text-[12px] leading-[1.5]", TONES[tone])}>{children}</p>
  );
}
