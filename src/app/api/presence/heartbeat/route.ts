import { NextResponse } from "next/server";
import { recordPresenceHeartbeat } from "@/lib/db/presence";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/presence/heartbeat, "esta conta ainda está com o Scriba aberto".
 *
 * Sem corpo: o único dado é QUEM chama, e isso já vem da sessão. Não cobra
 * moeda e não chama modelo, então não passa por `requireBalance` nem por
 * `parseJsonBody`. Ver `src/lib/db/presence.ts` para o que a escrita sustenta.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["presence-heartbeat"], auth.user.id);
  if (limited) return limited;

  await recordPresenceHeartbeat(auth.user.id);
  return NextResponse.json({ ok: true });
}
