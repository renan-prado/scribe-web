import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmptySession, listSessions, SESSION_MODES } from "@/lib/db/sessions";
import { parseClipRange, parseYoutubeUrl } from "@/lib/domain/youtube";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("sessions");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions — a Biblioteca inteira, para o cache do cliente.
 *
 * A lista MORAVA só no render do servidor de `/home`, o que significava
 * refazê-la a cada abertura do app e a cada volta para a Biblioteca, sempre do
 * zero, sempre com a tela em esqueleto até a resposta chegar. Agora ela é
 * guardada no aparelho (ver `features/session/query.ts`): a tela desenha do
 * disco na hora e chama isto atrás, para conferir o que mudou.
 *
 * É a mesma consulta de antes — `listSessions`, escopada pela RLS —, só que
 * alcançável pelo navegador. Não traz `final_summary` nem transcrição: o cartão
 * mostra autor, título e data, e o resto tem rota própria.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-read"], auth.user.id);
  if (limited) return limited;

  const sessions = await listSessions().catch((error: unknown) => {
    log.error("listSessions falhou", { error: String(error) });
    return null;
  });
  if (!sessions) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({ sessions });
}

const CreateSessionSchema = z
  .object({
    speakerName: z.string().trim().max(200).nullable().optional(),
    speakerLocation: z.string().trim().max(200).nullable().optional(),
    mode: z.enum(SESSION_MODES).optional(),
    /** Só o modo youtube manda. Validado abaixo, não aqui: o schema aceita
     * uma string e quem decide se ela é um vídeo é `parseYoutubeUrl`, o mesmo
     * parser que o diálogo usou para habilitar o botão. */
    sourceUrl: z.string().trim().max(2000).nullable().optional(),
    /** O recorte, só no modo youtube. Ver `parseClipRange`, que é quem decide
     * se o par faz sentido — o schema só garante que são inteiros de ms. */
    startMs: z.number().int().min(0).nullable().optional(),
    endMs: z.number().int().min(0).nullable().optional(),
  })
  .strict();

/**
 * POST /api/sessions
 *
 * Cria a linha vazia que ancora uma sessão. A gravação a cria no STOP, quando
 * já tem o áudio na mão (ver `AudioStudio`); a importação do YouTube a cria
 * antes, porque precisa da linha para guardar a URL. Ela nasce no Supabase com
 * `user_id = auth.uid()`, então a RLS escopa sozinha toda leitura e escrita
 * seguinte.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  // Empty body is intentional, user may not have typed a speaker/location
  // yet. Try to parse; on any body-shape error fall back to defaults.
  const parsed = await parseJsonBody(request, CreateSessionSchema.optional());
  if (!parsed.ok) return parsed.response;
  const body = parsed.data ?? {};

  const speakerName = body.speakerName?.trim() || null;
  const speakerLocation = body.speakerLocation?.trim() || null;
  const mode = body.mode ?? "audio";

  // O modo youtube não existe sem um vídeo: a linha nasceria com `source_url`
  // nulo e a página de importação não teria o que importar. Recusar aqui é o
  // que impede uma sessão órfã de aparecer em "Gravações em aberto" para
  // sempre, ela nunca poderia ser encerrada.
  //
  // A URL é NORMALIZADA para a forma canônica antes de ser gravada, e não
  // guardada como veio: `youtu.be/x?si=…`, `m.youtube.com/watch?v=x&list=…` e
  // `youtube.com/shorts/x` são o mesmo vídeo, e guardá-los como três strings
  // diferentes joga fora a única chance de um dia perguntar "quantas pessoas
  // importaram este vídeo?".
  let sourceUrl: string | null = null;
  // O recorte do vídeo, quando a pessoa pediu um trecho. Ele nasce JUNTO com a
  // linha, e não no POST da importação, porque `/importar/:id` redispara a
  // importação a cada reload: no corpo daquela rota, um "atrás" do navegador
  // importaria o vídeo inteiro pelo mesmo preço. Ver a migração 0060.
  let startMs: number | null = null;
  let endMs: number | null = null;
  if (mode === "youtube") {
    const parsedUrl = body.sourceUrl ? parseYoutubeUrl(body.sourceUrl) : null;
    if (!parsedUrl) {
      return NextResponse.json({ error: "invalid_youtube_url" }, { status: 400 });
    }
    sourceUrl = parsedUrl.canonicalUrl;

    const range = parseClipRange(body.startMs, body.endMs);
    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }
    startMs = range.clip?.startMs ?? null;
    endMs = range.clip?.endMs ?? null;
  }

  try {
    const id = await createEmptySession({
      speakerName,
      speakerLocation,
      mode,
      sourceUrl,
      sourceStartMs: startMs,
      sourceEndMs: endMs,
    });
    log.debug("created", { id, mode });
    return NextResponse.json({ id, mode });
  } catch (err) {
    log.error("create failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
