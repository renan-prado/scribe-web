/**
 * Recorrência e calendário — CLIENT-SAFE e puro.
 *
 * Duas contas moram aqui, e a especificação (§8) pede as duas porque elas
 * respondem perguntas diferentes:
 *
 *   EQUIVALENTE MENSAL  R$ 1.200/ano ≈ R$ 100/mês. É o custo PROVISIONADO —
 *                       a régua para comparar um domínio anual com a Vercel
 *                       mensal e para somar "quanto o Scriba custa por mês".
 *   OCORRÊNCIA          o domínio anual sai do caixa em MARÇO, inteiro, e nos
 *                       outros onze meses não sai nada. É o fluxo de caixa.
 *
 * Misturar as duas é o erro clássico do painel financeiro caseiro: ou o mês da
 * cobrança anual aparece como um pico inexplicável no custo, ou o mês seco
 * aparece como economia que não existe. Por isso a visão mensal usa as duas,
 * lado a lado e nomeadas.
 *
 * DATAS SÃO STRINGS `YYYY-MM-DD`, e a aritmética é feita em UTC. `new Date(
 * "2026-09-09")` é meia-noite UTC; formatá-la com o fuso local do Brasil
 * devolve o dia 8. Toda função aqui compara e monta strings — nenhuma delega
 * ao fuso da máquina que roda o código.
 */

import { type Cadence, type FinanceRecurring, MONTHS_PER_CADENCE } from "@/lib/domain/finance";

/** "2026-09-09" → "2026-09". A chave de agrupamento da visão mensal. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-09" → "setembro de 2026" (e "set/26" na forma curta, para eixo). */
const MONTH_NAMES = [
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

export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} de ${year}` : key;
}

export function formatMonthKeyShort(key: string): string {
  const [year, month] = key.split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name.slice(0, 3)}/${year.slice(2)}` : key;
}

/** Índice absoluto de mês desde o ano 0. Faz `b - a` valer "quantos meses". */
function monthIndex(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + (month - 1);
}

/** Inverso de `monthIndex`. */
function keyFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Quantos meses de `a` até `b` (negativo se `b` vem antes). */
export function monthsBetween(a: string, b: string): number {
  return monthIndex(monthKey(b)) - monthIndex(monthKey(a));
}

/** Soma meses a uma chave. `addMonths("2026-11", 3)` → "2027-02". */
export function addMonthsToKey(key: string, months: number): string {
  return keyFromIndex(monthIndex(key) + months);
}

/** Sequência inclusiva de chaves de mês. Vazia se `to` vem antes de `from`. */
export function monthRange(fromKey: string, toKey: string): string[] {
  const start = monthIndex(fromKey);
  const end = monthIndex(toKey);
  if (end < start) return [];
  const out: string[] = [];
  for (let i = start; i <= end; i += 1) out.push(keyFromIndex(i));
  return out;
}

/** Último dia do mês, em UTC. Fevereiro e os anos bissextos saem certos. */
function daysInMonth(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * A data da cobrança num mês, ancorada no dia do `startDate`.
 *
 * O dia é GRAMPEADO ao fim do mês: um contrato que começa em 31 de janeiro
 * cobra em 28 de fevereiro, não em 3 de março. Sem o clamp, `new Date(2026, 1,
 * 31)` transborda em silêncio e a cobrança pula para o mês seguinte — o tipo
 * de bug que só aparece em fevereiro e só em alguns anos.
 */
export function chargeDateInMonth(key: string, anchorDay: number): string {
  const day = Math.min(anchorDay, daysInMonth(key));
  return `${key}-${String(day).padStart(2, "0")}`;
}

/**
 * Custo mensal EQUIVALENTE de uma recorrência: o valor rateado pelos meses que
 * ele cobre. É a única forma de somar um domínio anual com uma hospedagem
 * mensal sem que o resultado dependa do mês em que se olha.
 *
 * Arredonda uma vez, aqui. R$ 80/ano vira R$ 6,67/mês, e doze desses somam
 * R$ 80,04 — quatro centavos de diferença contra o valor anual real. Isso é
 * inerente ao rateio, e é por isso que o custo ANUAL equivalente é calculado a
 * partir do valor original (`annualEquivalentCents`) e não multiplicando o
 * mensal por doze.
 */
export function monthlyEquivalentCents(amountCents: number, cadence: Cadence): number {
  return Math.round(amountCents / MONTHS_PER_CADENCE[cadence]);
}

/** Custo anual equivalente. Sai do valor ORIGINAL — ver a nota acima. */
export function annualEquivalentCents(amountCents: number, cadence: Cadence): number {
  return Math.round((amountCents * 12) / MONTHS_PER_CADENCE[cadence]);
}

/** Uma recorrência está viva num mês? Cancelada nunca está. */
export function isActiveInMonth(recurring: FinanceRecurring, key: string): boolean {
  if (recurring.status === "cancelled") return false;
  if (monthKey(recurring.startDate) > key) return false;
  if (recurring.endDate && monthKey(recurring.endDate) < key) return false;
  return true;
}

/**
 * Este mês tem cobrança desta recorrência?
 *
 * A cadência conta a partir do mês de início: uma trimestral que começou em
 * janeiro cobra em janeiro, abril, julho e outubro — não em todo mês divisível
 * por três do calendário.
 */
export function hasChargeInMonth(recurring: FinanceRecurring, key: string): boolean {
  if (!isActiveInMonth(recurring, key)) return false;
  const elapsed = monthsBetween(recurring.startDate, key);
  if (elapsed < 0) return false;
  if (elapsed % MONTHS_PER_CADENCE[recurring.cadence] !== 0) return false;
  // No mês do término, a cobrança só vale se cair antes do fim do contrato.
  if (recurring.endDate) {
    const anchorDay = Number(recurring.startDate.slice(8, 10));
    if (chargeDateInMonth(key, anchorDay) > recurring.endDate) return false;
  }
  return true;
}

/**
 * Próxima cobrança a partir de `today` (inclusive). `null` quando a
 * recorrência foi cancelada ou já terminou.
 *
 * Anda mês a mês em vez de resolver por aritmética modular de propósito: o
 * clamp de fim de mês e o corte pelo `endDate` fazem o caso fechado ter
 * exceções, e um laço de no máximo 60 passos é mais barato de LER do que a
 * fórmula que cobre todas elas.
 */
export function nextChargeDate(recurring: FinanceRecurring, today: string): string | null {
  if (recurring.status === "cancelled") return null;
  const anchorDay = Number(recurring.startDate.slice(8, 10));
  let key =
    monthKey(today) > monthKey(recurring.startDate)
      ? monthKey(today)
      : monthKey(recurring.startDate);
  for (let i = 0; i < 60; i += 1) {
    if (recurring.endDate && key > monthKey(recurring.endDate)) return null;
    if (hasChargeInMonth(recurring, key)) {
      const date = chargeDateInMonth(key, anchorDay);
      if (date >= today) return date;
    }
    key = addMonthsToKey(key, 1);
  }
  return null;
}

/** Hoje em `YYYY-MM-DD`, UTC. Uma função para o teste conseguir substituí-la. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
