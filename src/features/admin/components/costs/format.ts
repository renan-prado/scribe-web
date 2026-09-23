/**
 * Os formatadores das abas de /admin/costs.
 *
 * Eles moram num módulo só porque as quatro abas são o MESMO número visto de
 * quatro ângulos: enquanto "Uso & custos" e "Precificação" eram duas telas,
 * cada uma trazia a sua cópia de `INT`, de `BRL` e da regra de casas decimais,
 * e as cópias já divergiam (uma publicava custo com duas casas, a outra com
 * quatro, sem que a diferença quisesse dizer nada).
 *
 * A regra de casas é a de `lib/fx/format.ts`: o que é por MILHEIRO sai em real
 * e centavo, porque o milheiro existe justamente para o número caber em duas
 * casas; as quatro casas ficam só onde ainda fazem falta, no custo de UMA
 * execução, que num minuto de transcrição continua abaixo do centavo.
 */

export const INT = new Intl.NumberFormat("pt-BR");

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const BRL_FINE = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function brl(value: number | null): string {
  return value == null ? "-" : BRL.format(value);
}

export function brlFine(value: number | null): string {
  return value == null ? "-" : BRL_FINE.format(value);
}

export function percent(value: number | null): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

const MOMENT_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function moment(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : MOMENT_FMT.format(d);
}

export function latency(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}

export function duration(ms: number | null): string {
  if (!ms || ms <= 0) return "-";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** A moldura das tabelas do painel. Ver `admin-table` em `globals.css`. */
export const TABLE_SURFACE = "admin-table";
