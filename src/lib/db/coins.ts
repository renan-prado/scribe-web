import "server-only";
import {
  type ChargeReason,
  COIN_COST_BY_REASON,
  INITIAL_COIN_BALANCE,
} from "@/features/coins/pricing";
import { getCurrentAccount } from "@/lib/db/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * Server-side coin helpers. Balances live on public.profiles.coin_balance;
 * every spend goes through the SECURITY DEFINER function charge_coins() so
 * the check + decrement are atomic (see migration 0017).
 *
 * `chargeCoins` mapeia um `ChargeReason` conhecido para o preço canônico de
 * COIN_COST_BY_REASON, o cliente escolhe o MOTIVO, nunca o valor.
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

/** O que `getCycleUsage` devolve. Client-safe pela `BillingSummary`. */
export type CycleUsage = {
  /** Moedas creditadas na última recarga do plano. */
  grant: number;
  /** Moedas gastas desde então. Pode passar de `grant`: aí entrou a reserva. */
  spent: number;
  /** Quando a recarga aconteceu. */
  since: string;
};

/**
 * O ciclo de crédito do assinante: quando a franquia chegou, quanto ela foi, e
 * quanto já se gastou desde então.
 *
 * **A origem é o LEDGER, não o Stripe**, e a escolha é deliberada. A tabela
 * `subscriptions` guarda só `current_period_end`, e derivar "um mês antes" dele
 * daria a data errada exatamente onde ela importa: `ACTIVE_SUBSCRIPTION_STATUSES`
 * inclui `past_due` de propósito (o Stripe ainda está tentando cobrar e ninguém
 * perde acesso no primeiro retry falho), e nesse estado o PERÍODO vira sem que a
 * recarga aconteça. Com a data do Stripe, o anel encheria sozinho e diria "0%
 * usado" a quem não recebeu crédito nenhum.
 *
 * `subscription_grant` é o motivo que `features/billing/server/fulfill.ts`
 * escreve a cada fatura paga do plano, então a última linha dessas é o instante
 * exato em que a franquia entrou. Três coisas saem de graça daí:
 *
 *   - **a franquia é o `amount` daquela linha**, o que foi REALMENTE creditado,
 *     e não `PLANS[plano].coins`: proração, o clamp de quantidade do
 *     `creditInvoice` e qualquer mudança futura de plano entram certas sem o
 *     cálculo precisar saber que elas existem;
 *   - **troca de plano no meio do mês** gera uma fatura `subscription_update`
 *     que credita, ou seja, crédito novo e ciclo novo — que é o comportamento
 *     certo;
 *   - **a recarga atrasada que o `sweep` conserta** move o começo do ciclo para
 *     quando o dinheiro de fato chegou, não para quando ele deveria ter chegado.
 *
 * `null` = esta conta nunca recebeu franquia (nunca assinou, ou a primeira
 * fatura ainda não caiu). A tela volta a mostrar o saldo absoluto, que é a
 * informação certa para quem não tem renovação marcada. Ver
 * `docs/creditos-na-tela.md`.
 *
 * Pacote avulso (`topup_pack`) não entra em lugar nenhum desta conta: ele é
 * crédito, não gasto, e vive na RESERVA. Comprar um pacote não "devolve" o mês.
 */
export async function getCycleUsage(): Promise<CycleUsage | null> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data: grant, error: grantError } = await supabase
    .from("coin_transactions")
    .select("amount, created_at")
    .eq("user_id", user.id)
    .eq("reason", "subscription_grant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (grantError) throw new Error(`getCycleUsage failed: ${grantError.message}`);
  if (!grant) return null;

  const since = (grant as { amount: number; created_at: string }).created_at;
  const { data: spends, error: spendError } = await supabase
    .from("coin_transactions")
    .select("amount")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .gte("created_at", since);
  if (spendError) throw new Error(`getCycleUsage failed: ${spendError.message}`);

  const spent = ((spends ?? []) as { amount: number }[]).reduce((sum, r) => sum - r.amount, 0);
  return {
    grant: (grant as { amount: number }).amount,
    spent,
    since,
  };
}

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
