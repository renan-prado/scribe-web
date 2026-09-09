import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getFinanceSettings, updateFinanceSettings } from "@/lib/db/admin/finance";
import { SettingsInputSchema } from "@/lib/domain/finance";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configurações financeiras — linha única.
 *
 * Diferente da régua de simulação de moedas (`lib/coins/settings.ts`), que é
 * um COOKIE porque é preferência de quem está olhando, isto é fato da empresa:
 * o saldo em caixa e a alíquota valem para todo mundo que abrir o painel, e
 * mudar de máquina não pode zerar o runway.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  try {
    return NextResponse.json({ settings: await getFinanceSettings() });
  } catch (err) {
    log.error("get settings failed", { error: (err as Error).message });
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, SettingsInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const settings = await updateFinanceSettings(parsed.data);
    log.info("finance settings updated", {
      fields: Object.keys(parsed.data),
      by: auth.user.id,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    log.error("update settings failed", { error: (err as Error).message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
