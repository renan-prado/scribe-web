import { NextResponse } from "next/server";
import { getLexiconIndex } from "@/lib/db/lexicon";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

/**
 * O ÍNDICE de nomes publicados: o que o anotador precisa para marcar a prosa.
 *
 * **Ela existe porque o índice desce pelo LAYOUT, e layout não re-renderiza.**
 * O primeiro valor chega junto com o HTML, sem custo nenhum — e ficaria congelado
 * até um F5, porque o App Router reusa o payload do layout em toda navegação
 * entre telas que o compartilham. O sintoma era publicar um nome no painel,
 * abrir um resumo e não ver marcação nenhuma. Ver `LexiconProvider`.
 *
 * Só o `slug`, o termo, os apelidos e a categoria: o cartão continua sendo
 * buscado no toque, por `/api/lexicon/:slug`. Juntá-los faria cada revalidação
 * arrastar 300 descrições para marcar palavras.
 *
 * Sem modelo e sem moeda, como `/api/verse`. Quem impede o rascunho de sair não
 * é esta rota, é a policy da migração 0063.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.lexicon, auth.user.id);
  if (limited) return limited;

  return NextResponse.json({ entries: await getLexiconIndex() });
}
