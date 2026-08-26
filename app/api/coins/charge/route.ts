import { NextResponse } from "next/server";
import { z } from "zod";
import { CHARGE_REASONS } from "@/lib/coins/pricing";
import { chargeCoins } from "@/lib/db/coins";
import { OptionalUuidSchema, parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const BodySchema = z
  .object({
    reason: z.enum(CHARGE_REASONS),
    sessionId: OptionalUuidSchema,
  })
  .strict();

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

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { reason, sessionId: rawSessionId } = parsed.data;
  const sessionId = rawSessionId ?? null;

  const result = await chargeCoins(reason, sessionId);
  if (!result.ok) {
    if (result.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    console.error("[coins/charge] failed", {
      reason,
      error: result.error,
      message: result.message,
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ balance: result.balance, amount: result.amount });
}
