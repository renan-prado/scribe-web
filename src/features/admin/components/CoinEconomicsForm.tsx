import { CoinMark } from "@/components/icons/CoinMark";
import {
  COINS_PER_COST_UNIT,
  type CoinEconomicsSettings,
  DEFAULT_COIN_ECONOMICS,
} from "@/lib/coins/economics";
import { clearCoinEconomics, setCoinEconomics } from "@/lib/coins/settings-actions";

/**
 * A RÉGUA da tela de precificação: quanto vale a moeda que vendemos e qual
 * margem se está perseguindo. É o único bloco editável da página — todo o
 * resto é medição.
 *
 * O que se digita aqui não cobra nada de ninguém. O preço que o usuário paga é
 * o Price do Stripe e as moedas creditadas saem de `lib/billing/catalog.ts`;
 * isto é a régua de uma simulação, guardada num cookie do admin. O texto
 * abaixo do formulário diz isso na tela, porque um campo chamado "valor da
 * moeda" dentro do painel se parece MUITO com um campo que muda preço.
 *
 * Server component: o submit é uma Server Action, e a autorização real é o
 * `assertAdmin()` dentro dela — este formulário estar em /admin não protege
 * nada.
 */

const BRL_INPUT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INPUT_CLASS =
  "w-28 rounded-md border border-scriba-hairline bg-scriba-paper px-2.5 py-1.5 text-sm font-mono text-scriba-ink-strong focus:outline-none focus:ring-2 focus:ring-scriba-blue/40";

type Props = {
  settings: CoinEconomicsSettings;
  isCustom: boolean;
};

export function CoinEconomicsForm({ settings, isCustom }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-scriba-hairline-soft bg-scriba-paper p-5 shadow-[0_4px_14px_rgba(79,168,240,0.06)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-scriba-ink-strong">
          <CoinMark size={16} />A régua
        </h2>
        <span className="text-[11px] font-light uppercase tracking-[0.1em] text-scriba-ink-mute">
          {isCustom ? "ajustada" : "padrão"}
        </span>
      </div>

      <form action={setCoinEconomics} className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="coin-price"
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-scriba-ink-mute"
          >
            R$ por {COINS_PER_COST_UNIT.toLocaleString("pt-BR")} moedas
          </label>
          <input
            id="coin-price"
            name="pricePerThousandBrl"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]+([.,][0-9]{1,4})?"
            defaultValue={BRL_INPUT.format(settings.pricePerThousandBrl)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="target-margin"
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-scriba-ink-mute"
          >
            Margem alvo (%)
          </label>
          <input
            id="target-margin"
            name="targetMarginPct"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]{1,2}([.,][0-9]{1,2})?"
            defaultValue={String(settings.targetMarginPct).replace(".", ",")}
            className={INPUT_CLASS}
          />
        </div>

        <button
          type="submit"
          className="rounded-md scriba-cta bg-[image:var(--scriba-cta)] px-3 py-1.5 text-[12px] font-semibold text-scriba-cta-ink transition-opacity hover:opacity-90"
        >
          Aplicar
        </button>
      </form>

      <p className="text-[11.5px] font-light leading-relaxed text-scriba-ink-mute">
        Simulação, não cobrança: o que o usuário paga é o Price do Stripe e as moedas creditadas
        saem do catálogo em código. O padrão é o pacote avulso —{" "}
        <span className="font-mono">
          R$ {BRL_INPUT.format(DEFAULT_COIN_ECONOMICS.pricePerThousandBrl)}
        </span>{" "}
        o milheiro, o preço marginal de quem ficou sem saldo.
      </p>

      {isCustom ? (
        <form action={clearCoinEconomics}>
          <button
            type="submit"
            className="text-[11.5px] font-light text-scriba-ink-mute underline underline-offset-2 hover:text-scriba-ink"
          >
            voltar ao padrão
          </button>
        </form>
      ) : null}
    </section>
  );
}
