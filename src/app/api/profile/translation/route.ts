import { NextResponse } from "next/server";
import { z } from "zod";
import { TRANSLATION_IDS, TRANSLATIONS } from "@/lib/bibles/translations";
import { setBibleTranslation } from "@/lib/db/profiles";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("profile/translation");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/profile/translation: a tradução bíblica preferida.
 *
 * O corpo aceita `null` para VOLTAR ao padrão do produto, e não só um id: sem
 * isso, quem experimentou a Almeida 1911 ficaria com ela gravada para sempre,
 * porque "o padrão" deixaria de ser alcançável no instante em que a primeira
 * escolha fosse feita. Nulo é um estado, não a ausência de um.
 *
 * Aqui a NVI é recusada com 400, e não silenciosamente trocada pelo padrão como
 * em `/api/verse`. A diferença é o que cada rota faz com o valor: lá ele é usado
 * e jogado fora, e cair no padrão devolve um versículo certo; aqui ele seria
 * GRAVADO, e uma preferência por uma tradução proprietária guardada na linha da
 * pessoa é a licença sendo furada por uma requisição, em silêncio.
 */
const BodySchema = z
  .object({ translation: z.enum(TRANSLATION_IDS).nullable() })
  .strict()
  .refine((b) => b.translation === null || TRANSLATIONS[b.translation].selectable, {
    message: "tradução não selecionável",
  });

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["profile-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    await setBibleTranslation(auth.user.id, parsed.data.translation);
  } catch (err) {
    log.error("falha ao gravar a tradução preferida", { error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  log.debug("ok", { translation: parsed.data.translation ?? "padrão" });
  return NextResponse.json({ ok: true });
}
