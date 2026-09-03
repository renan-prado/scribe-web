import { NextResponse } from "next/server";
import { z } from "zod";
import { loadBible } from "@/lib/bibles/loader";
import { lookupPassage } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/feed";
import type { PassagePayload, VerseResponse } from "@/lib/domain/verse";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("verse");

/**
 * Texto bíblico para uma ou mais passagens, em UMA resposta.
 *
 * A rota aceitava uma referência por chamada e devolvia texto corrido, e a UI
 * pedia VERSÍCULO A VERSÍCULO — sete requisições para "Isaías 1:11-17". Um
 * estudo com dezessete blocos de passagem passava de sessenta chamadas em
 * poucos segundos e batia no rate limit; os versículos que voltavam 429
 * simplesmente não apareciam, e a tela ficava com números soltos sem texto.
 *
 * O lote conserta a causa, não o sintoma: a página inteira vira uma chamada.
 * O limite de 60/min continua onde estava e agora é folgadíssimo.
 *
 * Compatibilidade: `reference` (string) e `references` (array) são aceitos, e
 * a resposta é SEMPRE `{ passages: [...] }`. Um formato só para os dois casos
 * evita que o cliente tenha dois caminhos de parse.
 */

// Uma referência como "1 Coríntios 13:1-13" cabe folgada em 200. O teto de 24
// referências cobre o maior estudo já gerado (17 passagens) com margem, e
// impede que um cliente peça a Bíblia inteira numa requisição.
const ReferenceSchema = z.string().max(200);
const BodySchema = z
  .object({
    reference: ReferenceSchema.optional(),
    references: z.array(ReferenceSchema).max(24).optional(),
  })
  .strict()
  .refine((b) => b.reference != null || b.references != null, {
    message: "informe reference ou references",
  });

export type { PassagePayload, VerseResponse } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.verse, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const requested = [
    ...(parsed.data.reference ? [parsed.data.reference] : []),
    ...(parsed.data.references ?? []),
  ]
    .map((r) => r.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return NextResponse.json({ error: "empty reference" }, { status: 400 });
  }

  const bible = await loadBible();
  if (!bible) {
    log.warn("miss", { reason: "translation-file-missing" });
    return NextResponse.json({ passages: [] } satisfies VerseResponse);
  }

  const passages: PassagePayload[] = [];
  const missed: string[] = [];

  for (const reference of requested) {
    const ref = parseVerseReference(reference);
    if (!ref) {
      missed.push(reference);
      continue;
    }
    // Referência sem versículo ("Salmos 23") é o capítulo inteiro. O teto alto
    // não é arbitrário: o Salmo 119 tem 176 versículos, e `lookupPassage` para
    // sozinho no primeiro buraco.
    const start = ref.startVerse ?? 1;
    const end = ref.endVerse ?? ref.startVerse ?? 176;

    const verses = lookupPassage(bible, ref.bookDisplay, ref.chapter, start, end);
    if (verses.length === 0) {
      missed.push(reference);
      continue;
    }
    passages.push({
      reference,
      book: ref.bookDisplay,
      chapter: ref.chapter,
      verses,
    });
  }

  if (missed.length > 0) {
    // `warn` e não `debug`: referência que não resolve num estudo já publicado
    // significa versículo faltando na tela do usuário, e é o rastro que leva
    // ao livro com nome fora do mapa de abreviações.
    log.warn("referências não resolvidas", { missed: missed.join(" | ") });
  }
  log.debug("ok", { pedidas: requested.length, resolvidas: passages.length });

  return NextResponse.json({ passages } satisfies VerseResponse);
}
