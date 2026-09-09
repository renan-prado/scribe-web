import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createRecurring, listRecurring } from "@/lib/db/admin/finance";
import { RecurringInputSchema } from "@/lib/domain/finance";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contratos recorrentes. Ver o cabeçalho de `entries/route.ts` sobre o gate. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  try {
    return NextResponse.json({ recurring: await listRecurring() });
  } catch (err) {
    log.error("list recurring failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, RecurringInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const recurring = await createRecurring(parsed.data, auth.user.id);
    log.info("recurring created", {
      id: recurring.id,
      cadence: recurring.cadence,
      amountCents: recurring.amountCents,
      by: auth.user.id,
    });
    return NextResponse.json({ recurring }, { status: 201 });
  } catch (err) {
    log.error("create recurring failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
