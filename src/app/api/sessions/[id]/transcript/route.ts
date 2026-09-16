import { NextResponse } from "next/server";
import { getSessionTranscript } from "@/lib/db/sessions";
import { parseUuidParam } from "@/lib/http/validate";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/:id/transcript — o texto bruto de uma sessão.
 *
 * Existe porque a transcrição SAIU do payload de `/summary/:id`. Ela viajava
 * inteira para o navegador em toda abertura do resumo (dezenas de KB num
 * sermão de quarenta minutos) para preencher um dialog que só abre pelo menu de
 * três pontinhos; a página agora manda só `hasTranscript`, e o texto vem por
 * aqui no instante em que alguém pede para vê-lo.
 *
 * Isso é o que torna o resumo barato o bastante para ser PREFETCHADO e
 * guardado no cliente: com a transcrição dentro, adiantar a sessão ao encostar
 * o dedo no cartão custaria mais banda do que economizaria.
 *
 * A RLS é quem escopa: `getSessionTranscript` devolve `null` para id alheio ou
 * inexistente, e os dois viram 404 — a existência da sessão de outra pessoa não
 * é informação nossa para confirmar.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-read"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  const found = await getSessionTranscript(guarded.id).catch(() => null);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(found);
}
