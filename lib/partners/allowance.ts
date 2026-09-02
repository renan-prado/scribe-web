import "server-only";
import { grantCoins } from "@/lib/db/billing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A mesada mensal de moedas do parceiro.
 *
 * Existe por uma razão de produto, não de contabilidade: quem divulga precisa
 * usar. Um parceiro sem saldo não grava, e quem não grava para de ter o que
 * contar — o programa morre em silêncio, sem que nada apareça num painel.
 *
 * RENOVAÇÃO PREGUIÇOSA, sem cron. O crédito acontece quando o parceiro
 * aparece, exatamente como o check de assinatura vencida em
 * `/api/billing/summary`. Um cron para isso seria uma peça móvel a mais para
 * resolver um problema que só importa quando a pessoa está na tela.
 *
 * DUAS TRAVAS, em ordem de custo:
 *   1. `partners.allowance_month` — comparação em memória, sobre uma linha
 *      que o chamador já carregou. É o que evita ir ao banco em toda visita.
 *   2. `coin_transactions.external_ref` UNIQUE — a trava de verdade. Duas
 *      abas abertas no mesmo segundo passam as duas pela trava 1; só uma
 *      credita.
 *
 * Se as duas discordarem, quem manda é o ledger: `allowance_month` é cache.
 */

/** Primeiro dia do mês corrente, em AAAA-MM-DD. */
function currentMonthStart(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function allowanceIsDue(
  monthlyCoins: number,
  allowanceMonth: string | null,
  now = new Date()
): boolean {
  if (monthlyCoins <= 0) return false;
  if (!allowanceMonth) return true;
  return allowanceMonth.slice(0, 7) < currentMonthStart(now).slice(0, 7);
}

/**
 * Credita a mesada do mês, se devida. Devolve as moedas creditadas AGORA — 0
 * quando não havia nada a fazer.
 *
 * Nunca lança: é chamada no caminho de renderização de todas as páginas do
 * app, e uma falha ao creditar moedas de cortesia não pode derrubar a
 * navegação de quem só queria abrir o feed. O mesmo raciocínio do `try/catch`
 * em volta da comissão dentro de `fulfill.ts`.
 */
export async function ensurePartnerAllowance(args: {
  partnerId: string;
  userId: string;
  monthlyCoins: number;
  allowanceMonth: string | null;
}): Promise<number> {
  if (!allowanceIsDue(args.monthlyCoins, args.allowanceMonth)) return 0;

  const month = currentMonthStart();
  try {
    const balance = await grantCoins({
      userId: args.userId,
      amount: args.monthlyCoins,
      reason: "partner_allowance",
      externalRef: `partner_allowance:${args.partnerId}:${month.slice(0, 7)}`,
    });
    if (balance === null) return 0;

    // Carimba o mês mesmo quando o crédito já existia no ledger (external_ref
    // repetido): o objetivo da coluna é justamente parar de tentar.
    const admin = createAdminClient();
    const { error } = await admin
      .from("partners")
      .update({ allowance_month: month })
      .eq("id", args.partnerId);
    if (error) {
      console.error("[partners] mesada creditada mas allowance_month não gravado", {
        partnerId: args.partnerId,
        month,
        error: error.message,
      });
    }

    console.info("[partners] mesada creditada", {
      partnerId: args.partnerId,
      coins: args.monthlyCoins,
      month,
    });
    return args.monthlyCoins;
  } catch (err) {
    console.error("[partners] falha ao creditar mesada", {
      partnerId: args.partnerId,
      error: (err as Error).message,
    });
    return 0;
  }
}
