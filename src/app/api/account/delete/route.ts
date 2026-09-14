import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/lib/account/delete-account";
import { DELETE_CONFIRMATION } from "@/lib/domain/account";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient, getAuthUser } from "@/lib/supabase/server";

const log = createLogger("account/delete");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    confirmation: z.literal(DELETE_CONFIRMATION),
  })
  .strict();

/**
 * POST /api/account/delete, a exclusão da própria conta.
 *
 * Existe por três exigências que pedem a mesma coisa: a LGPD (art. 18, V), a
 * regra 5.1.1(v) da App Store e a política de exclusão de conta do Google
 * Play, que pede uma URL onde o usuário faça o pedido, ver
 * `docs/app-store-ios.md`. Por isso ela APAGA de verdade, em vez de abrir um
 * chamado: as três regras falam de um caminho que o usuário percorre sozinho.
 *
 * **O gate é `getAuthUser`, não `requireAuth`, e a diferença importa.**
 * `requireAuth` recusa com 403 a conta que um admin desativou, o que está
 * certo em toda rota que GASTA alguma coisa nossa. Aqui seria o avesso do
 * propósito: quem foi banido é exatamente quem mais quer sair, e prender os
 * dados de alguém dentro de uma conta que ele não pode mais usar é o oposto do
 * que a lei pede. Nenhum saldo é lido e nenhum modelo é chamado, então não há
 * nada que `is_active` protegesse aqui.
 *
 * O `signOut` no fim é limpeza de cookie, não segurança: o usuário já não
 * existe e o refresh token morreu com ele. Sem essa linha o navegador
 * continuaria mandando um cookie morto até o Supabase desistir dele, e o
 * app renderizaria meia sessão pelo caminho.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const limited = enforceRateLimit(request, RATE_LIMITS["account-delete"], user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    await deleteAccount(user.id);
  } catch (err) {
    log.error("exclusão de conta falhou", { userId: user.id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {});

  return NextResponse.json({ ok: true });
}
