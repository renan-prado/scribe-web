import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmptySession, getSessionMeta, updateSessionSummary } from "@/lib/db/sessions";
import { WrittenSummarySchema, writtenToPayload } from "@/lib/domain/summary";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("written");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    /** Ausente na primeira gravação: é ela que cria a linha. */
    id: z.uuid().optional(),
    summary: WrittenSummarySchema,
  })
  .strict();

/**
 * POST /api/sessions/written
 *
 * Salva o texto que a pessoa ESCREVEU em `/escrever`. Cria a sessão quando não
 * vem `id`, sobrescreve quando vem, e devolve o id nos dois casos.
 *
 * **Uma rota para os dois, e não um POST e um PUT**, porque para quem chama é
 * uma ação só: o editor salva sozinho a cada pausa da digitação, e ele não
 * deveria ter de saber se aquele salvamento é o primeiro. O primeiro é o único
 * que cria, e "criar" aqui é uma linha vazia seguida do mesmo UPDATE que todos
 * os outros fazem.
 *
 * **Não cobra moeda, e não há o que discutir aqui:** não existe transcrição,
 * não existe chamada de modelo, não existe provedor. É o único caminho do
 * produto que produz um resumo de graça, e é de graça porque o trabalho foi
 * todo de quem escreveu.
 *
 * **O payload é o único que entra vindo do CLIENTE.** Um resumo gravado nasce
 * dentro do servidor, a partir da resposta do modelo; este chega por POST, e é
 * por isso que `WrittenSummarySchema` tem teto em cada campo e em cada lista:
 * sem eles uma aba empurraria megabytes de jsonb para dentro da linha.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const payload = writtenToPayload(parsed.data.summary);
  let id = parsed.data.id;

  if (id) {
    // Dono ANTES de trabalhar, como manda `app/AGENTS.md`. A RLS já escoparia
    // o UPDATE, mas um id alheio receberia `{ ok: true }` mesmo assim, porque
    // UPDATE que casa zero linhas não é erro no PostgREST. 404 e não 403: a
    // existência da sessão de outra pessoa não é informação nossa para
    // confirmar.
    const owned = await getSessionMeta(id).catch(() => null);
    if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // O editor só sabe escrever o vocabulário de `WRITTEN_BLOCK_TYPES`, e uma
    // sessão gravada tem blocos que ele não desenha. Deixar este POST tocar
    // uma sessão `audio` seria apagar em silêncio o que a IA escreveu sobre
    // uma pregação — e apagar junto a transcrição da tela, que continuaria no
    // banco sem nada que a explicasse.
    if (owned.mode !== "manual") {
      return NextResponse.json({ error: "not_manual" }, { status: 409 });
    }
  } else {
    try {
      id = await createEmptySession({
        speakerName: null,
        speakerLocation: null,
        mode: "manual",
      });
    } catch (err) {
      log.error("create failed", { error: (err as Error).message });
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
  }

  try {
    await updateSessionSummary(id, payload, { markEnded: true });
  } catch (err) {
    log.error("save failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  log.debug("saved", { id, blocks: payload.blocks.length });
  return NextResponse.json({ id });
}
