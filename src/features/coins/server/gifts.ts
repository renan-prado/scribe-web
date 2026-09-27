import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("coins/gifts");

/**
 * Presente de moedas pendente de resgate.
 *
 * Substitui o crédito instantâneo que `/admin/users` fazia direto pela porta
 * única (`grantCoins`, em `lib/db/billing.ts`): o admin agora só EMITE a
 * promessa aqui, e o crédito de verdade acontece dentro da RPC
 * `redeem_coin_gift`, no instante em que a pessoa toca "Resgatar". Ver a
 * migração 0077.
 */
export type CoinGift = {
  id: string;
  amount: number;
  title: string;
  message: string;
  createdAt: string;
};

type CoinGiftRow = {
  id: string;
  amount: number;
  title: string;
  message: string;
  created_at: string;
};

function rowToGift(row: CoinGiftRow): CoinGift {
  return {
    id: row.id,
    amount: row.amount,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
  };
}

/**
 * Emite um presente na conta de alguém, com service-role: não há policy de
 * INSERT para `authenticated` (ver 0077), então esta é a ÚNICA porta de
 * criação.
 *
 * **`grantedBy` aceita `null`, e o nulo tem significado.** Quase todo presente
 * é ato de uma pessoa no `/admin/users`, e ali a coluna guarda quem o
 * emitiu. O do testador (`applyWelcomeBonuses`) não tem autor: ele é uma
 * regra do programa, disparada no primeiro login de quem se pré-cadastrou, e
 * carimbar nela o admin que nem estava na frente do computador inventaria uma
 * decisão que ninguém tomou naquele instante.
 */
export async function createCoinGift(args: {
  userId: string;
  amount: number;
  title: string;
  message: string;
  grantedBy: string | null;
}): Promise<CoinGift | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coin_gifts")
    .insert({
      user_id: args.userId,
      amount: args.amount,
      title: args.title,
      message: args.message,
      granted_by: args.grantedBy,
    })
    .select("id, amount, title, message, created_at")
    .single();
  if (error) {
    log.error("createCoinGift failed", { userId: args.userId, error: error.message });
    return null;
  }
  return rowToGift(data as CoinGiftRow);
}

/** Presentes ainda não resgatados do usuário autenticado (RLS escopa). */
export async function listOwnPendingGifts(): Promise<CoinGift[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coin_gifts")
    .select("id, amount, title, message, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listOwnPendingGifts failed: ${error.message}`);
  return (data ?? []).map((row) => rowToGift(row as CoinGiftRow));
}

export type RedeemGiftResult = "ok" | "not_found" | "already_redeemed" | "error";

/**
 * Resgata um presente do usuário autenticado. `userId` vem da SESSÃO de quem
 * chama, nunca do corpo do request — ver o cabeçalho da RPC na migração 0077.
 */
export async function redeemCoinGift(userId: string, giftId: string): Promise<RedeemGiftResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_coin_gift", {
    p_user_id: userId,
    p_gift_id: giftId,
  });
  if (error) {
    log.error("redeem_coin_gift failed", { userId, giftId, error: error.message });
    return "error";
  }
  if (data === "ok" || data === "not_found" || data === "already_redeemed") return data;
  return "error";
}
