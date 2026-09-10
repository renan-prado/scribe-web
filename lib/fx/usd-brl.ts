import "server-only";

import { cookies } from "next/headers";
import { readLatestUsdBrlRate, saveUsdBrlRate } from "@/lib/db/fx-rates";
import { createLogger } from "@/lib/log";

const log = createLogger("fx");

/**
 * O câmbio USD→BRL do painel. Ele multiplica TODO número em real do
 * `/admin/*`: custo por rota, custo por 1.000 moedas, margem por ação, passivo
 * de moedas, custo de IA do financeiro. Sem ele, a regra "valor em dólar sem
 * cotação é null, jamais 0" (lib/AGENTS.md) apaga cada um desses campos.
 *
 * QUATRO FONTES, NESTA ORDEM:
 *
 *   1. AwesomeAPI: cotação viva do mercado brasileiro, sem chave, cacheada 1h;
 *   2. Frankfurter: cotação de referência do BCE, sem chave, atualizada em
 *      dia útil. Segunda fonte VIVA, não terceira opção;
 *   3. o valor que o admin digitou à mão, num cookie server-readable;
 *   4. a última cotação guardada em `usd_brl_rates` (migração 0049).
 *
 * OS DEGRAUS 2 E 4 EXISTEM POR UM SINISTRO REAL. O painel passou dias exibindo
 * "sem câmbio" em cada campo em real, com 328 chamadas medidas e o custo em
 * dólar gravado corretamente no banco. Só havia o degrau 1 e o cookie: o
 * upstream limita por IP e o IP de saída da Vercel é compartilhado, o cookie
 * vale por NAVEGADOR e nunca havia sido digitado, e as duas únicas fontes
 * falhavam juntas. O resultado era `null`, sem erro nenhum na tela, o pior
 * jeito de uma medição falhar.
 *
 * Uma fonte a mais consertaria o incidente daquele dia; ela não conserta a
 * CLASSE do problema, que é o painel depender de um terceiro estar de pé no
 * instante em que alguém abre a tela. É o degrau 4 que fecha isso: toda leitura
 * viva bem-sucedida é guardada, e a partir da primeira o pior caso deixa de ser
 * "sem câmbio" e passa a ser "o câmbio de ontem, dito na tela".
 *
 * O cookie fica ACIMA do valor guardado de propósito: ele é uma decisão
 * explícita de quem está olhando, e quem digitou uma cotação quer aquela, não a
 * de anteontem. E fica ABAIXO das fontes vivas pela razão simétrica: enquanto o
 * mercado responde, o número medido vence a opinião.
 */

export type UsdBrlSource = "awesomeapi" | "frankfurter" | "manual" | "stored";

export type UsdBrlRate = {
  rate: number;
  fetchedAt: string;
  source: UsdBrlSource;
};

const AWESOME_URL = "https://economia.awesomeapi.com.br/last/USD-BRL";
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL";

export const MANUAL_FX_COOKIE = "scriba_fx_usd_brl_manual";

type AwesomeResponse = {
  USDBRL?: { bid?: string; ask?: string; create_date?: string; timestamp?: string };
};

type FrankfurterResponse = { date?: string; rates?: { BRL?: number } };

type ManualCookiePayload = { rate: number; setAt: string };

function isUsableRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Toda fonte viva devolve isto; `null` significa "tente a próxima". */
type LiveQuote = { rate: number; fetchedAt: string } | null;

async function fetchAwesome(): Promise<LiveQuote> {
  try {
    const res = await fetch(AWESOME_URL, { next: { revalidate: 3600, tags: ["fx-usd-brl"] } });
    if (!res.ok) {
      log.warn("awesomeapi non-ok", { status: res.status });
      return null;
    }
    const body = (await res.json()) as AwesomeResponse;
    const bid = body.USDBRL?.bid;
    const rate = bid ? Number.parseFloat(bid) : Number.NaN;
    if (!isUsableRate(rate)) {
      log.warn("awesomeapi payload inválido", { bid });
      return null;
    }
    return { rate, fetchedAt: body.USDBRL?.create_date ?? new Date().toISOString() };
  } catch (err) {
    log.warn("awesomeapi falhou", { error: (err as Error).message });
    return null;
  }
}

async function fetchFrankfurter(): Promise<LiveQuote> {
  try {
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 3600, tags: ["fx-usd-brl"] },
    });
    if (!res.ok) {
      log.warn("frankfurter non-ok", { status: res.status });
      return null;
    }
    const body = (await res.json()) as FrankfurterResponse;
    const rate = body.rates?.BRL;
    if (!isUsableRate(rate)) {
      log.warn("frankfurter payload inválido", { rate });
      return null;
    }
    // `date` é o dia da referência do BCE (YYYY-MM-DD), sem hora.
    return { rate, fetchedAt: body.date ?? new Date().toISOString() };
  } catch (err) {
    log.warn("frankfurter falhou", { error: (err as Error).message });
    return null;
  }
}

async function readManualCookie(): Promise<UsdBrlRate | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(MANUAL_FX_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManualCookiePayload;
    if (!isUsableRate(parsed.rate)) return null;
    return {
      rate: parsed.rate,
      fetchedAt: parsed.setAt ?? new Date().toISOString(),
      source: "manual",
    };
  } catch {
    return null;
  }
}

/**
 * O que este processo já gravou. A instância é reusada entre requests (Fluid
 * Compute), e sem esta guarda cada render de cada tela do admin emitiria um
 * upsert idêntico ao anterior. Ela erra para o lado seguro: o pior caso é
 * gravar de novo depois de um cold start.
 */
let persisted: { day: string; rate: number } | null = null;

async function persist(rate: number, source: UsdBrlSource): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  if (persisted && persisted.day === day && persisted.rate === rate) return;
  persisted = { day, rate };
  // Aguardado, e não solto com `void`: numa função serverless o trabalho que
  // sobra depois da resposta pode simplesmente não acontecer, e um plano B que
  // grava "quase sempre" não é plano B. O custo é UM upsert por instância a
  // cada cotação nova, a guarda acima é o que impede que seja um por render.
  await saveUsdBrlRate(rate, source);
}

export async function getUsdToBrl(): Promise<UsdBrlRate | null> {
  const live: [UsdBrlSource, () => Promise<LiveQuote>][] = [
    ["awesomeapi", fetchAwesome],
    ["frankfurter", fetchFrankfurter],
  ];

  for (const [source, load] of live) {
    const quote = await load();
    if (!quote) continue;
    await persist(quote.rate, source);
    return { rate: quote.rate, fetchedAt: quote.fetchedAt, source };
  }

  const manual = await readManualCookie();
  if (manual) return manual;

  const stored = await readLatestUsdBrlRate();
  if (stored) {
    return { rate: stored.rate, fetchedAt: stored.fetchedAt, source: "stored" };
  }

  log.warn("nenhuma fonte de câmbio respondeu, o painel fica sem valores em real");
  return null;
}
