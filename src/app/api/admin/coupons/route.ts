import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createCoupon, deleteCoupon, setCouponActive } from "@/lib/db/coupons";
import { CouponCodeSchema, CouponCreateSchema } from "@/lib/domain/coupon";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/coupons");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emitir, desativar e apagar cupons de cadastro.
 *
 * **Esta rota EMITE moeda**, no sentido de que um cupom vivo credita saldo a
 * toda conta nova que o usar, então ela é tão sensível quanto uma rota de
 * crédito, mesmo sem chamar `grant_coins` uma única vez. Daí três coisas:
 *
 *   - `requireAdmin()` responde 404, não 403, como todo `/api/admin/*`;
 *   - os limites (moedas por cupom, resgates por cupom) são conferidos pelo
 *     Zod ANTES e pelo CHECK da migração 0055 DEPOIS. Os dois existem porque o
 *     primeiro produz mensagem e o segundo produz garantia;
 *   - `max_redemptions` é obrigatório. Não há como emitir um cupom sem teto por
 *     esta rota, porque não há como emitir um cupom sem teto, ponto.
 *
 * O que ela NÃO faz: editar o valor de um cupom já emitido. Um link que já
 * circula prometendo 200 moedas não pode passar a valer 20 sem que ninguém
 * saiba: quem quer mudar o valor desativa aquele e emite outro, e aí o histórico
 * de resgates continua explicando o extrato de cada pessoa.
 */

const BodySchema = z.discriminatedUnion("action", [
  // O `...shape` e não um `.and()`: uma união discriminada exige objetos, e uma
  // interseção não é um objeto para o Zod, ela passa no `tsc` e falha na hora
  // de discriminar.
  z.object({ action: z.literal("create"), ...CouponCreateSchema.shape }),
  z.object({ action: z.literal("toggle"), code: CouponCodeSchema, isActive: z.boolean() }),
  z.object({ action: z.literal("delete"), code: CouponCodeSchema }),
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
    if (body.action === "create") {
      const result = await createCoupon(body, auth.user.id);
      if (result === "duplicate") {
        return NextResponse.json({ error: "duplicate_code" }, { status: 409 });
      }
      if (result === "error") {
        return NextResponse.json({ error: "write_failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "toggle") {
      await setCouponActive(body.code, body.isActive);
      return NextResponse.json({ ok: true });
    }

    const result = await deleteCoupon(body.code);
    if (result === "in_use") {
      // 409 e não 500: não é falha, é a regra. Cupom já resgatado não se apaga,
      // porque o registro do resgate é o que explica o crédito no extrato de
      // quem o usou. Ver o `on delete restrict` da migração 0055.
      return NextResponse.json({ error: "coupon_in_use" }, { status: 409 });
    }
    if (result === "error") {
      return NextResponse.json({ error: "write_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("write failed", { action: body.action, error: (err as Error).message });
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
