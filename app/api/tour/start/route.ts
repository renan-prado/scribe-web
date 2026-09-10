import { NextResponse } from "next/server";
import { z } from "zod";
import { claimTour } from "@/lib/db/tours";
import { TOUR_KEYS } from "@/lib/domain/tour";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("tour/start");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ tour: z.enum(TOUR_KEYS) }).strict();

/**
 * POST /api/tour/start, "posso mostrar este tour agora?".
 *
 * POST, e não GET, porque ela ESCREVE: quando a resposta é sim, o tour já
 * nasce registrado em `user_tours`. É o que impede a apresentação de voltar
 * quando a pessoa reabre a mesma tela, e um GET que grava seria disparado por
 * qualquer prefetch do router.
 *
 * O cliente não manda versão nem passo: ele diz em que tela está. Quem sabe
 * qual versão daquele tour esta pessoa já viu é o servidor (`claimTour`), e a
 * conferência é refeita aqui mesmo tendo o navegador uma cópia do mapa, é ela
 * que resolve duas abas abertas na mesma tela.
 *
 * Erro vira "não mostrar". Um tour é um extra sobre uma tela que já funciona
 * sozinha; derrubá-la por causa da apresentação dela seria trocar o produto
 * pela explicação do produto.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["tour-start"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const run = await claimTour({ userId: auth.user.id, tour: parsed.data.tour });
    return NextResponse.json({ run });
  } catch (err) {
    log.error("falha ao abrir tour", { error: (err as Error).message });
    return NextResponse.json({ run: false });
  }
}
