import { NextResponse } from "next/server";
import { isChargeReason } from "@/lib/coins/pricing";
import { chargeCoins } from "@/lib/db/coins";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Atomic coin debit. Body: { reason, sessionId? }. The cost is derived from
 * the reason on the server — clients never send amounts. Returns 402 with
 * `{ error: "insufficient_balance" }` when the caller can't afford the
 * charge; recording clients treat that as a signal to stop capturing.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["coins-write"], auth.user.id);
  if (limited) return limited;

  let body: { reason?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (!isChargeReason(body.reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;

  const result = await chargeCoins(body.reason, sessionId);
  if (!result.ok) {
    if (result.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    console.error("[coins/charge] failed", {
      reason: body.reason,
      error: result.error,
      message: result.message,
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ balance: result.balance, amount: result.amount });
}
