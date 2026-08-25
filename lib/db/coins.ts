import "server-only";
import { type ChargeReason, COIN_COST_BY_REASON, INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("coin_balance")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`getCurrentBalance failed: ${error.message}`);
  return (data?.coin_balance as number | undefined) ?? INITIAL_COIN_BALANCE;
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
