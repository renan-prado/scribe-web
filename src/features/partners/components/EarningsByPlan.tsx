import { formatBrl, PAID_PLAN_KEYS, PLANS } from "@/lib/billing/plans";
import { commissionCents, PAYOUT_MINIMUM_CENTS } from "@/lib/partners/economics";

/**
 * Quanto o parceiro ganha por cada tipo de assinatura.
 *
 * Server component: são só números derivados do catálogo público de planos e
 * da taxa dele — nada aqui precisa de interação, e mantê-lo fora do bundle é
 * de graça.
 *
 * Existe porque "30% da primeira mensalidade" é uma fórmula, não um valor. O
 * parceiro não vai fazer essa conta de cabeça antes de gravar um vídeo, e sem
 * ela ele também não sabe que indicar um Estudioso vale mais que o dobro de um
 * Pessoal — que é exatamente o tipo de coisa que muda o que ele fala.
 *
 * O mínimo de saque é mencionado no rodapé, em uma frase, e NÃO como um
 * "faltam N assinantes" por linha: junto do valor da comissão, aquele número
 * era lido como se o parceiro precisasse de N assinantes para ganhar aquilo.
 *
 * Os valores saem de `lib/billing/plans.ts` — o MESMO catálogo do checkout e
 * da landing. Número de comissão calculado sobre preço copiado à mão é uma
 * promessa que quebra na hora do pagamento.
 */

type Props = {
  /** Taxa do parceiro, em basis points. */
  rateBps: number;
};

export function EarningsByPlan({ rateBps }: Props) {
  const rows = PAID_PLAN_KEYS.map((key) => {
    const plan = PLANS[key];
    return {
      key,
      name: plan.name,
      priceCents: plan.priceCents,
      commissionCents: commissionCents(plan.priceCents, rateBps),
    };
  });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[14px] font-semibold text-scriba-ink-strong">
          Quanto você ganha por assinatura
        </h2>
        <p className="text-[12.5px] font-light leading-[1.5] text-scriba-ink-soft">
          {(rateBps / 100).toLocaleString("pt-BR")}% da primeira mensalidade, uma vez por pessoa
          indicada.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-scriba-hairline">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-scriba-ink-strong">
                Plano {row.name}
              </span>
              <span className="text-[11.5px] font-light text-scriba-ink-mute">
                {formatBrl(row.priceCents)} por mês
              </span>
            </div>
            <span className="flex-none font-mono text-[15px] font-semibold text-scriba-ink-strong">
              {formatBrl(row.commissionCents)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-mute">
        A conta é sobre o valor cheio da mensalidade — o mesmo preço que aparece na página de
        planos, então você consegue conferir sozinho. {formatBrl(PAYOUT_MINIMUM_CENTS)} é o mínimo
        para um pagamento sair; abaixo disso o saldo acumula para o mês seguinte e não se perde.
      </p>
    </section>
  );
}
