import { NextResponse } from "next/server";
import { getLexiconCard } from "@/lib/db/lexicon";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

/**
 * O cartão de um nome do léxico, buscado quando alguém toca numa palavra
 * marcada do resumo.
 *
 * **GET, e não POST como `/api/verse`.** Aquela nasceu POST porque recebe uma
 * lista de referências que não caberia bem numa query string; aqui o pedido é
 * um identificador no caminho, que é o formato que o navegador, o cache e o
 * React Query já sabem tratar.
 *
 * A leitura passa pelo client do USUÁRIO, e é a policy da migração 0063 que
 * garante que rascunho não sai daqui — não um filtro escrito nesta rota. Ver o
 * cabeçalho de `db/lexicon.ts`.
 *
 * `requireAuth` porque só tela logada desenha menção: a landing não monta o
 * provedor do léxico e portanto não marca nome nenhum. Se um dia ela marcar,
 * esta linha é o que precisa cair primeiro, e aí o gate vira só o rate limit.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.lexicon, auth.user.id);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const card = await getLexiconCard(slug);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ card });
}
