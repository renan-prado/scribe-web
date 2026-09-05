import "server-only";
import { type ChargeReason, COIN_COST_BY_REASON, INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

/**
 * Server-side coin helpers. Balances live on public.profiles.coin_balance;
 * every spend goes through the SECURITY DEFINER function charge_coins() so
 * the check + decrement are atomic (see migration 0017).
 *
 * `chargeCoins` mapeia um `ChargeReason` conhecido para o preço canônico de
 * COIN_COST_BY_REASON — o cliente escolhe o MOTIVO, nunca o valor.
 *
 * **O client é o service-role, e isso é a proteção, não um atalho.** Até a
 * migração 0037, `charge_coins` tinha EXECUTE para `authenticated` e recebia o
 * valor por parâmetro: dava para chamar a RPC direto do navegador com o anon
 * key e debitar 1 moeda por um minuto que custa 7, deixando no ledger uma
 * linha com cara de legítima. Hoje a função só aceita service_role, e quem
 * afirma QUEM está pagando é este módulo, com o id que veio de
 * `requireAuth()`.
 *
 * Corolário: `userId` aqui nunca pode sair do corpo de um request. Ele vem do
 * `auth.user.id` de uma sessão já verificada, e é a única coisa que separa
 * este caminho de um débito arbitrário na conta de qualquer pessoa.
 */

export async function getCurrentBalance(): Promise<number | null> {
  const account = await getCurrentAccount();
  if (account) return account.coinBalance;
  // `null` significa "não há usuário", e SÓ isso. Um usuário autenticado sem
  // linha em `profiles` não deveria existir (a trigger de 0005 cria uma no
  // insert em auth.users), mas se existir ele recebe o saldo inicial, não
  // zero: devolver zero trancaria a gravação de alguém por uma inconsistência
  // que não é dele.
  const user = await getAuthUser();
  return user ? INITIAL_COIN_BALANCE : null;
}

export type ChargeResult =
  | { ok: true; balance: number; amount: number }
  | {
      ok: false;
      error: "insufficient_balance" | "not_authenticated" | "unknown";
      message?: string;
    };

export async function chargeCoins(
  reason: ChargeReason,
  sessionId: string | null,
  userId: string
): Promise<ChargeResult> {
  const amount = COIN_COST_BY_REASON[reason];
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("charge_coins", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_session_id: sessionId,
  });

  if (error) {
    if (error.message.includes("insufficient_balance")) {
      return { ok: false, error: "insufficient_balance" };
    }
    if (error.message.includes("not_authenticated")) {
      return { ok: false, error: "not_authenticated" };
    }
    return { ok: false, error: "unknown", message: error.message };
  }
  const balance = typeof data === "number" ? data : Number(data);
  return { ok: true, balance, amount };
}
