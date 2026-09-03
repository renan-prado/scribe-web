import "server-only";
import { type ChargeReason, COIN_COST_BY_REASON, INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * Server-side coin helpers. Balances live on public.profiles.coin_balance;
 * every spend goes through the SECURITY DEFINER function charge_coins() so
 * the check + decrement are atomic (see migration 0012).
 *
 * chargeCoins never sends an amount from the client — it maps a known
 * ChargeReason to the canonical price in COIN_COST_BY_REASON so a spoofed
 * body cannot change the cost.
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
  sessionId: string | null
): Promise<ChargeResult> {
  const amount = COIN_COST_BY_REASON[reason];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("charge_coins", {
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
