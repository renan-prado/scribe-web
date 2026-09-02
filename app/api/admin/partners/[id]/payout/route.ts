import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { registerPayout } from "@/lib/db/admin/partners";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registra que um PIX foi enviado e quita as comissões correspondentes.
 *
 * O corpo NÃO aceita valor. O montante é o que estava disponível no instante
 * da chamada, somado pelo servidor a partir das próprias comissões — assim a
 * linha de pagamento e as comissões que ela quita sempre fecham. Um valor
 * digitado à mão abriria a possibilidade de o total pago divergir do total
 * quitado, e essa diferença não teria onde aparecer.
 */
const BodySchema = z
  .object({
    /** Mês de referência (AAAA-MM-DD, dia 1). Só rótulo. */
    period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await registerPayout({
      partnerId: guarded.id,
      period: parsed.data.period,
      note: parsed.data.note ?? null,
    });
    if (!result) {
      return NextResponse.json({ error: "nothing_due" }, { status: 409 });
    }
    console.info("[admin/partners] payout registered", {
      partnerId: guarded.id,
      amountCents: result.amountCents,
      commissions: result.commissions,
      by: auth.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[admin/partners] payout failed", {
      partnerId: guarded.id,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "payout_failed" }, { status: 500 });
  }
}
