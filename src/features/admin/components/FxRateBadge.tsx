import { clearManualUsdBrlRate, setManualUsdBrlRate } from "@/lib/fx/actions";
import type { UsdBrlRate } from "@/lib/fx/usd-brl";

const BRL_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFetchedAt(raw: string): string {
  // AwesomeAPI returns "YYYY-MM-DD HH:mm:ss" in America/Sao_Paulo; the
  // manual cookie stores ISO ("2026-08-25T14:30:00.000Z"). Both parse
  // via Date after replacing space→T.
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return raw;
  return DATE_FMT.format(d);
}

export function FxRateBadge({ rate }: { rate: UsdBrlRate | null }) {
  if (!rate) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] text-muted-foreground">
          Não consegui obter a cotação do dia. Preencha manualmente:
        </p>
        <form action={setManualUsdBrlRate} className="flex flex-wrap items-center gap-2">
          <label htmlFor="fx-manual-rate" className="text-[0.7rem] text-muted-foreground">
            R$ por US$
          </label>
          <input
            id="fx-manual-rate"
            name="rate"
            type="text"
            inputMode="decimal"
            placeholder="5,42"
            required
            pattern="[0-9]+([.,][0-9]{1,4})?"
            className="w-24 rounded-md border border-scriba-hairline bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-scriba-blue/40"
          />
          <button
            type="submit"
            className="rounded-md bg-scriba-blue px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Salvar
          </button>
        </form>
      </div>
    );
  }

  if (rate.source === "manual") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
        <span>
          Valores convertidos a{" "}
          <span className="font-mono font-medium">R$ {BRL_FMT.format(rate.rate)}</span> por US$ ·
          valor manual definido em {formatFetchedAt(rate.fetchedAt)}
        </span>
        <form action={clearManualUsdBrlRate}>
          <button type="submit" className="underline underline-offset-2 hover:text-foreground">
            limpar
          </button>
        </form>
      </p>
    );
  }

  return (
    <p className="text-[0.7rem] text-muted-foreground">
      Valores convertidos a{" "}
      <span className="font-mono font-medium">R$ {BRL_FMT.format(rate.rate)}</span> por US$ ·
      atualizado {formatFetchedAt(rate.fetchedAt)} (AwesomeAPI)
    </p>
  );
}
