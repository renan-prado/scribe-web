import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createScenario, listScenarios } from "@/lib/db/admin/finance";
import { ScenarioInputSchema } from "@/lib/domain/finance";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cenários de projeção, as PREMISSAS, nunca o resultado.
 *
 * O resultado não é gravado em lugar nenhum: ele é recalculado a cada leitura
 * por `lib/finance/projection.ts`, porque a base dele (assinantes de hoje,
 * ARPU medido, custo por cliente medido) muda sozinha. Um resultado guardado
 * envelheceria em silêncio e seria lido como se ainda valesse.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  try {
    return NextResponse.json({ scenarios: await listScenarios() });
  } catch (err) {
    log.error("list scenarios failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, ScenarioInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const scenario = await createScenario(parsed.data);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "scenario_exists" }, { status: 409 });
    }
    log.error("create scenario failed", { error: message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
