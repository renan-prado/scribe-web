import { NextResponse } from "next/server";
import { resetTours } from "@/lib/db/tours";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("tour/reset");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tour/reset, o "Rever os tours" do /profile.
 *
 * Apaga TODAS as linhas de `user_tours` da pessoa, e é a única rota desta
 * família cujo erro precisa aparecer na tela: aqui foi ela que pediu, e um
 * clique que não faz nada e não avisa é pior que um botão que não existe.
 *
 * Não recebe corpo. Qual tour rever não é uma pergunta que quem clica está
 * fazendo, ver `resetTours`.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["tour-write"], auth.user.id);
  if (limited) return limited;

  try {
    await resetTours(auth.user.id);
  } catch (err) {
    log.error("falha ao limpar tours", { error: (err as Error).message });
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
