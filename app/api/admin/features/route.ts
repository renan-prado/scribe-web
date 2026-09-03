import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  clearFeatureOverride,
  findUserIdByEmail,
  setFeatureOverride,
  setFeatureSwitch,
} from "@/lib/db/feature-flags";
import { isFeatureKey } from "@/lib/entitlements/features";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/features");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As DUAS únicas coisas de entitlement que se editam em runtime: o kill
 * switch por feature e a exceção por pessoa.
 *
 * O que esta rota NÃO faz — e nunca deve fazer — é mexer no mapa
 * `feature → plano mínimo`. Ele mora em `lib/entitlements/features.ts`, em
 * código, pelo mesmo motivo que o mapa `Price ID → moedas` mora em
 * `lib/billing/catalog.ts`: um endpoint que reescreve o valor de um plano é
 * um endpoint que, no pior dia, dá o plano de graça. Mudar o plano mínimo de
 * uma feature é um deploy, com revisão, e é assim que queremos.
 *
 * `feature` é validado contra `isFeatureKey` antes de qualquer escrita: sem
 * isso, um typo cria uma linha órfã que nunca é lida e todo mundo passa uma
 * tarde procurando por que o switch "não funcionou".
 */

const FeatureSchema = z.string().refine(isFeatureKey, "unknown_feature");

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("switch"),
    feature: FeatureSchema,
    enabled: z.boolean(),
    note: z.string().trim().max(280).nullable().optional(),
  }),
  z.object({
    action: z.literal("override"),
    feature: FeatureSchema,
    email: z.string().trim().email().max(320),
    granted: z.boolean(),
    note: z.string().trim().max(280).nullable().optional(),
  }),
  z.object({
    action: z.literal("clear-override"),
    feature: FeatureSchema,
    userId: z.string().uuid(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (body.action === "switch") {
      await setFeatureSwitch({
        feature: body.feature,
        enabled: body.enabled,
        note: body.note ?? null,
        adminId: auth.user.id,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "override") {
      const userId = await findUserIdByEmail(body.email);
      if (!userId) {
        return NextResponse.json({ error: "user_not_found" }, { status: 404 });
      }
      await setFeatureOverride({
        userId,
        feature: body.feature,
        granted: body.granted,
        note: body.note ?? null,
        adminId: auth.user.id,
      });
      return NextResponse.json({ ok: true, userId });
    }

    await clearFeatureOverride(body.userId, body.feature);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("write failed", { action: body.action, error: (err as Error).message });
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
