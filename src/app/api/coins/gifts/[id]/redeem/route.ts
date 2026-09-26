import { NextResponse } from "next/server";
import { redeemCoinGift } from "@/features/coins/server/gifts";
import { parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("coins/gifts/redeem");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resgata um presente pendente: aqui a moeda entra de verdade, pela porta
 * única (`grant_coins`, dentro da RPC `redeem_coin_gift`). Ver a migração
 * 0077 e `src/features/coins/server/gifts.ts`.
 *
 * `userId` vem da SESSÃO, nunca do corpo — a RPC trava a linha do presente e
 * confere o dono de novo, então mesmo um id de outra pessoa colado aqui não
 * credita nada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["coin-gift-redeem"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  const result = await redeemCoinGift(auth.user.id, guarded.id);

  if (result === "error") {
    log.error("redeem failed", { userId: auth.user.id, giftId: guarded.id });
    return NextResponse.json({ error: "redeem_failed" }, { status: 422 });
  }
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result === "already_redeemed") {
    return NextResponse.json({ error: "already_redeemed" }, { status: 409 });
  }

  log.info("redeemed", { userId: auth.user.id, giftId: guarded.id });
  return NextResponse.json({ ok: true });
}
