import type { UsdBrlRate } from "@/lib/fx/usd-brl";

const BRL_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFetchedAt(raw: string): string {
  // AwesomeAPI returns "YYYY-MM-DD HH:mm:ss" in America/Sao_Paulo — safe
  // to feed into Date since JS treats it as local, matching the user's TZ.
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return raw;
  return DATE_FMT.format(d);
}

export function FxRateBadge({ rate }: { rate: UsdBrlRate | null }) {
  if (!rate) {
    return (
      <p className="text-[0.7rem] text-muted-foreground">
        Valores em USD — não consegui obter a cotação do dia.
      </p>
    );
  }
  return (
    <p className="text-[0.7rem] text-muted-foreground">
      Valores convertidos a{" "}
      <span className="font-mono font-medium">R$ {BRL_FMT.format(rate.rate)}</span> por USD ·
      atualizado {formatFetchedAt(rate.fetchedAt)} (AwesomeAPI)
    </p>
  );
}
