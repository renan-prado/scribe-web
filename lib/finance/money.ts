/**
 * Dinheiro do controle financeiro — CLIENT-SAFE, e a única aritmética
 * monetária da área.
 *
 * Três regras que valem para tudo que este arquivo toca:
 *
 * 1. **Valor é INTEIRO em centavos.** Nunca `number` de reais. `0.1 + 0.2` em
 *    ponto flutuante é `0.30000000000000004`, e doze meses de projeção compõem
 *    esse erro justamente na ponta longa, que é a que se olha para decidir.
 * 2. **O arredondamento acontece UMA vez, na fronteira.** Converter, ratear e
 *    projetar trabalham em centavos inteiros e arredondam com
 *    `Math.round` (meio para cima, simétrico o bastante para valores que já
 *    são positivos) no instante em que o resultado vira um centavo. Arredondar
 *    a cada passo intermediário faz a soma das partes deixar de bater com o
 *    todo — que é como um painel financeiro perde a confiança de quem o lê.
 * 3. **Toda comparação é feita em BRL.** O painel tem uma moeda de
 *    apresentação só. Somar dólar com real "porque os dois são dinheiro" é o
 *    erro que produz um total plausível e errado.
 *
 * Sobre o câmbio, a decisão está no cabeçalho da migração 0043 e se
 * implementa em `entryAmountBrlCents`: liquidado usa o câmbio CONGELADO no
 * dia; pendente e previsto usam a cotação VIVA, porque é hoje que eles seriam
 * pagos.
 */

import type { Currency, FinanceEntry } from "@/lib/domain/finance";

/** O câmbio em vigor para uma leitura. `null` quando não há cotação nenhuma. */
export type FxContext = {
  /** USD → BRL. */
  usdBrl: number | null;
};

/**
 * Converte para centavos de BRL. Devolve `null` quando o valor está em dólar e
 * não há cotação — e `null` é deliberado: um dólar convertido a zero soma zero
 * e some do total sem avisar, e um total que esconde uma despesa é pior que um
 * total que se recusa a existir. A UI mostra "sem cotação" onde isso acontece.
 */
export function toBrlCents(
  amountCents: number,
  currency: Currency,
  rate: number | null
): number | null {
  if (currency === "BRL") return Math.round(amountCents);
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amountCents * rate);
}

/**
 * Valor de um lançamento em centavos de BRL.
 *
 * Liquidado usa `fxRate` (o câmbio do dia do pagamento); qualquer outro estado
 * usa a cotação viva. Um lançamento liquidado em dólar SEM `fxRate` gravado
 * cai na cotação viva também — é o melhor palpite disponível, e é o caso dos
 * dados importados à mão.
 */
export function entryAmountBrlCents(entry: FinanceEntry, fx: FxContext): number | null {
  const rate = entry.status === "paid" && entry.fxRate ? entry.fxRate : fx.usdBrl;
  return toBrlCents(entry.amountCents, entry.currency, rate);
}

/** Quanto já foi pago deste lançamento, em BRL. Mesmo câmbio do valor cheio. */
export function entryPaidBrlCents(entry: FinanceEntry, fx: FxContext): number | null {
  if (entry.paidCents === 0) return 0;
  const rate = entry.status === "paid" && entry.fxRate ? entry.fxRate : fx.usdBrl;
  return toBrlCents(entry.paidCents, entry.currency, rate);
}

/** O que ainda se deve (ou se tem a receber) deste lançamento, em BRL. */
export function entryRemainingBrlCents(entry: FinanceEntry, fx: FxContext): number | null {
  const total = entryAmountBrlCents(entry, fx);
  const paid = entryPaidBrlCents(entry, fx);
  if (total === null || paid === null) return null;
  return Math.max(0, total - paid);
}

/**
 * Soma que IGNORA o que não deu para converter, e informa quantos ignorou.
 *
 * A alternativa — tratar não-convertível como zero — daria um total redondo
 * que nunca denuncia o buraco. Aqui o chamador recebe `unconvertible` e a tela
 * consegue dizer "3 lançamentos em dólar fora deste total, falta a cotação".
 */
export function sumBrlCents(values: (number | null)[]): {
  total: number;
  unconvertible: number;
} {
  let total = 0;
  let unconvertible = 0;
  for (const v of values) {
    if (v === null) unconvertible += 1;
    else total += v;
  }
  return { total, unconvertible };
}

/**
 * Aplica uma taxa em basis points a um valor em centavos.
 * 10.000 bps = 100%. Inteiro na entrada, inteiro na saída, um arredondamento.
 */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

/** Margem como fração (0,62 = 62%). `null` quando não há receita — dividir por
 * zero devolveria `Infinity`, que a tela renderizaria como um número. */
export function marginRatio(revenueCents: number, costCents: number): number | null {
  if (revenueCents <= 0) return null;
  return (revenueCents - costCents) / revenueCents;
}

/** Variação relativa entre dois períodos. `null` quando não há base. */
export function growthRatio(currentCents: number, previousCents: number): number | null {
  if (previousCents <= 0) return null;
  return (currentCents - previousCents) / previousCents;
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Centavos de BRL → "R$ 1.234,56". `null` vira travessão, e não "R$ 0,00":
 * "não deu para converter" e "é zero" são coisas diferentes, e a tela precisa
 * conseguir dizer qual das duas.
 */
export function formatBrlCents(cents: number | null): string {
  if (cents === null) return "—";
  return BRL.format(cents / 100);
}

/** Valor na moeda ORIGINAL do lançamento. Usado nas listas, ao lado do BRL:
 * quem lançou US$ 500 precisa reconhecer o próprio número. */
export function formatNativeCents(cents: number, currency: Currency): string {
  return currency === "USD" ? USD.format(cents / 100) : BRL.format(cents / 100);
}

/** Fração → "62,4%". `null` vira travessão pelo mesmo motivo acima. */
export function formatPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Fração com sinal — para variação mês a mês, onde o sinal é a informação. */
export function formatSignedPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Basis points → "10%" / "7,5%". */
export function formatBps(bps: number): string {
  const value = bps / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
  return `${text.replace(".", ",")}%`;
}

/**
 * Lê um valor digitado por gente e devolve centavos.
 *
 * Aceita "1.234,56" (pt-BR), "1234.56" (en-US), "R$ 1.234,56" e "1234". A
 * ambiguidade real é o ponto: em "1.234" ele é separador de milhar, em "1.23"
 * é decimal. A regra aplicada — se existe vírgula, ela é o decimal e o ponto é
 * milhar; se não existe, um ponto seguido de exatamente três dígitos é milhar
 * — é a que acerta os dois casos que aparecem de fato num campo em português.
 *
 * Devolve `null` para o que não é número. Nunca `0`: um campo em branco tratado
 * como zero grava uma despesa de R$ 0,00 que ninguém pediu.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;

  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}$/.test(cleaned) && (cleaned.match(/\./g) ?? []).length >= 1) {
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
