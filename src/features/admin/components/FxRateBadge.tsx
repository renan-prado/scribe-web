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

/**
 * Qual provedor respondeu. Vai para a tela porque as duas fontes vivas não
 * cotam a mesma coisa: a AwesomeAPI dá o mercado à vista e a Frankfurter, a
 * referência do BCE do último dia útil. A diferença é de centavos, mas explica
 * por que o mesmo painel mostrou 5,13 ontem e 5,09 hoje.
 */
const LIVE_SOURCE_LABEL: Partial<Record<UsdBrlRate["source"], string>> = {
  awesomeapi: "AwesomeAPI",
  frankfurter: "Frankfurter · BCE",
};

function formatFetchedAt(raw: string): string {
  // AwesomeAPI returns "YYYY-MM-DD HH:mm:ss" in America/Sao_Paulo; the
  // manual cookie stores ISO ("2026-08-25T14:30:00.000Z"). Both parse
  // via Date after replacing space→T.
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return raw;
  return DATE_FMT.format(d);
}

/**
 * O formulário do valor manual. Aparece nos DOIS casos em que a cotação viva
 * não veio — sem nenhuma cotação, e rodando com a última guardada —, porque em
 * ambos existe a mesma pergunta a fazer a quem está olhando: "o número de hoje
 * é outro?".
 */
function ManualRateForm() {
  return (
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
        className="w-24 rounded-md border border-scriba-hairline bg-scriba-paper px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-scriba-blue/40"
      />
      <button
        type="submit"
        className="rounded-md scriba-cta bg-[image:var(--scriba-cta)] px-2.5 py-1 text-[11px] font-semibold text-scriba-cta-ink transition-opacity hover:opacity-90"
      >
        Salvar
      </button>
    </form>
  );
}

export function FxRateBadge({ rate }: { rate: UsdBrlRate | null }) {
  if (!rate) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] text-muted-foreground">
          Não consegui obter a cotação do dia e não há nenhuma guardada — todos os valores em real
          estão em branco. Preencha manualmente:
        </p>
        <ManualRateForm />
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

  // A cotação viva não veio, mas o painel NÃO fica cego: converte pela última
  // guardada e diz de quando ela é. Um câmbio de ontem erra na segunda casa;
  // a ausência dele apagaria toda a coluna em real.
  if (rate.source === "stored") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] text-muted-foreground">
          Valores convertidos a{" "}
          <span className="font-mono font-medium">R$ {BRL_FMT.format(rate.rate)}</span> por US$ ·
          última cotação guardada, de {formatFetchedAt(rate.fetchedAt)}. A cotação de hoje não
          respondeu.
        </p>
        <ManualRateForm />
      </div>
    );
  }

  return (
    <p className="text-[0.7rem] text-muted-foreground">
      Valores convertidos a{" "}
      <span className="font-mono font-medium">R$ {BRL_FMT.format(rate.rate)}</span> por US$ ·
      atualizado {formatFetchedAt(rate.fetchedAt)} ({LIVE_SOURCE_LABEL[rate.source] ?? rate.source})
    </p>
  );
}
