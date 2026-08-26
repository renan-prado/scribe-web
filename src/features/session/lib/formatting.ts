/**
 * Session-scope date/duration formatters shared between the library list,
 * feed, and summary pages. Portuguese labels are inline — no i18n framework
 * yet.
 */

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const MONTHS_PT_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "3 mai" or "3 mai 2024" — compact date, optional year. */
export function shortDate(iso: string, includeYear = false): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS_PT_SHORT[d.getMonth()]}`;
  return includeYear ? `${base} ${d.getFullYear()}` : base;
}

/**
 * "Esta semana" / "Semana passada" / "Maio" / "Maio 2024" — used to group
 * sessions in the library list into rolling time buckets.
 */
export function groupLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const dow = start.getDay(); // 0 = Sunday
  const daysSinceMon = (dow + 6) % 7;
  const startOfWeek = new Date(start.getTime() - daysSinceMon * dayMs);
  const startOfLastWeek = new Date(startOfWeek.getTime() - 7 * dayMs);
  if (d >= startOfWeek) return "Esta semana";
  if (d >= startOfLastWeek) return "Semana passada";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
    return capitalize(MONTHS_PT_LONG[d.getMonth()]);
  }
  if (d.getFullYear() === now.getFullYear()) return capitalize(MONTHS_PT_LONG[d.getMonth()]);
  return `${capitalize(MONTHS_PT_LONG[d.getMonth()])} ${d.getFullYear()}`;
}

/** "5 min" or "45s" — compact form used in the library list. */
export function formatDurationShort(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m} min`;
}

/** "5m 07s" or "45s" — verbose form used on the summary page. */
export function formatDurationLong(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
