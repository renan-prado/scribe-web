"use client";

import { BookOpen, Lock } from "lucide-react";
import { useState } from "react";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { formatBrl, PLANS } from "@/lib/billing/plans";
import { FEATURES } from "@/lib/entitlements/features";

/**
 * O que o `/studies` mostra para quem não tem o plano que libera "Gerar
 * estudo".
 *
 * Duas variantes, e a escolha entre elas é a regra de produto inteira:
 *
 *   - "full": a pessoa nunca gerou um estudo. A página inteira vira o convite
 *     — não faz sentido explicar como gerar algo que ela não pode gerar, que
 *     é o que o `StudiesEmptyState` faz.
 *   - "banner": a pessoa TEM estudos, gerados quando ainda podia. A lista
 *     continua ali e o convite fica acima dela. Esconder conteúdo que a pessoa
 *     já pagou para produzir seria confisco — só a GERAÇÃO é restrita.
 *
 * A copy nomeia o plano e o preço lidos de `lib/billing/plans.ts`, o mesmo
 * catálogo do diálogo de compra e da landing. Preço de tela próprio aqui seria
 * promessa quebrada no checkout — já aconteceu com os créditos.
 */

const FEATURE = FEATURES.study_generation;
const PLAN = PLANS[FEATURE.minPlan];

const WHAT_YOU_GET = [
  "Um estudo próprio sobre o tema de cada sermão — não um resumo mais longo",
  "Contexto histórico, distinções doutrinárias e as objeções que ficaram de fora",
  "Versículos conferidos e autores citados com a obra onde a frase está",
];

type Props = { variant: "full" | "banner" };

export function StudiesUpsell({ variant }: Props) {
  const [billingOpen, setBillingOpen] = useState(false);

  const cta = (
    <button
      type="button"
      onClick={() => setBillingOpen(true)}
      className="scriba-cta inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--scriba-cta)] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-scriba-cta-ink shadow-[0_5px_14px_var(--scriba-cta-shadow)] transition-colors"
    >
      <BookOpen aria-hidden className="size-3.5" />
      Assinar o {PLAN.name}
    </button>
  );

  if (variant === "banner") {
    return (
      <aside className="flex flex-col gap-3 rounded-2xl bg-scriba-blue-soft/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            <Lock aria-hidden className="size-3" />
            Plano {PLAN.name}
          </span>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink">
            Seus estudos continuam aqui para ler quando quiser. Para gerar novos, é preciso o plano{" "}
            {PLAN.name}.
          </p>
        </div>
        <div className="shrink-0">{cta}</div>
        <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
      </aside>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-scriba-paper">
      <div className="flex flex-col items-center px-5 pt-6 pb-8 text-center sm:px-8 sm:pt-9">
        {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
        <img
          src="/stickers/men/012-man.svg"
          alt=""
          aria-hidden
          width={240}
          height={240}
          className="h-auto w-[116px] sm:w-[180px]"
        />

        <div className="mt-1 flex max-w-[420px] flex-col gap-2 sm:mt-1.5">
          <span className="inline-flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            <Lock aria-hidden className="size-3" />
            Plano {PLAN.name}
          </span>
          <h2 className="text-pretty text-[19px] font-semibold leading-tight tracking-tight text-scriba-ink-strong sm:text-[24px]">
            O estudo aprofundado faz parte do {PLAN.name}.
          </h2>
          <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink-soft sm:text-sm">
            Depois de cada sermão, o Scriba pode ir além do resumo e escrever um estudo sobre o tema
            — com o que o pregador não teve tempo de trazer.
          </p>
        </div>

        <div className="mt-5">{cta}</div>
        <p className="mt-2 text-[11px] font-light text-scriba-ink-mute">
          {formatBrl(PLAN.priceCents)} por mês · cancele quando quiser
        </p>
      </div>

      <div className="border-t border-scriba-hairline-soft bg-scriba-surface px-5 py-4 sm:px-12 sm:py-6">
        <ul className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-8">
          {WHAT_YOU_GET.map((item) => (
            <li key={item} className="flex items-start gap-3 sm:flex-col sm:gap-1.5">
              <span
                aria-hidden
                className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-scriba-green-soft"
              >
                <BookOpen className="size-3.5 text-scriba-green-ink" />
              </span>
              <span className="text-[12.5px] font-light leading-relaxed text-scriba-ink-soft">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </div>
  );
}
