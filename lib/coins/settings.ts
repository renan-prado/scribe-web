import "server-only";

import { cookies } from "next/headers";
import {
  type CoinEconomicsSettings,
  DEFAULT_COIN_ECONOMICS,
  normalizeCoinEconomics,
} from "./economics";

/**
 * Onde mora o valor de venda da moeda e a margem alvo que a tela de
 * precificação usa.
 *
 * É um COOKIE do admin, e não uma tabela, pela mesma razão do câmbio manual em
 * `lib/fx/usd-brl.ts`: nada aqui decide cobrança. O preço que o usuário paga é
 * o Price do Stripe, e as moedas creditadas saem de `lib/billing/catalog.ts`.
 * Isto é a régua de UMA simulação — o admin gira o número para ver a margem se
 * mexer, e o que ele girou não pode virar preço em lugar nenhum. Gravar num
 * cookie deixa essa fronteira óbvia; gravar numa tabela chamada
 * `coin_pricing` seria um convite para alguém, um dia, ler dali para cobrar.
 *
 * Consequência aceita: o ajuste é por navegador, não por conta.
 */

export const COIN_ECONOMICS_COOKIE = "scriba_coin_economics";

export async function getCoinEconomics(): Promise<CoinEconomicsSettings> {
  try {
    const jar = await cookies();
    const raw = jar.get(COIN_ECONOMICS_COOKIE)?.value;
    if (!raw) return DEFAULT_COIN_ECONOMICS;
    return normalizeCoinEconomics(JSON.parse(raw) as Partial<CoinEconomicsSettings>);
  } catch {
    return DEFAULT_COIN_ECONOMICS;
  }
}

/** True quando o admin ajustou os valores — a tela mostra o botão de limpar. */
export async function hasCustomCoinEconomics(): Promise<boolean> {
  try {
    const jar = await cookies();
    return jar.get(COIN_ECONOMICS_COOKIE)?.value != null;
  } catch {
    return false;
  }
}
