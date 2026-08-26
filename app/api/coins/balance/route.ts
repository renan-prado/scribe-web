import { NextResponse } from "next/server";
import { getCurrentBalance } from "@/lib/db/coins";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the caller's current coin balance. Used by the client to re-sync
 * after actions that spend coins (recording ticks, aprofundar). */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["coins-read"], auth.user.id);
  if (limited) return limited;

  const balance = await getCurrentBalance();
  return NextResponse.json({ balance: balance ?? 0 });
}
