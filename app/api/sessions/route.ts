import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmptySession, SESSION_MODES } from "@/lib/db/sessions";
import { parseYoutubeUrl } from "@/lib/domain/youtube";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("sessions");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSessionSchema = z
  .object({
    speakerName: z.string().trim().max(200).nullable().optional(),
    speakerLocation: z.string().trim().max(200).nullable().optional(),
    mode: z.enum(SESSION_MODES).optional(),
    /** Só o modo youtube manda. Validado abaixo, não aqui: o schema aceita
     * uma string e quem decide se ela é um vídeo é `parseYoutubeUrl`, o mesmo
     * parser que o diálogo usou para habilitar o botão. */
    sourceUrl: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

/**
 * POST /api/sessions
 * Creates the empty row that anchors /recording/{id}/live. Called from the
 * "Nova gravação" dialog in the app header. The row
 * lives in Supabase with user_id = auth.uid() so RLS auto-scopes every
 * subsequent read/update.
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
  const mode = body.mode ?? "live";

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
  if (mode === "youtube") {
    const parsedUrl = body.sourceUrl ? parseYoutubeUrl(body.sourceUrl) : null;
    if (!parsedUrl) {
      return NextResponse.json({ error: "invalid_youtube_url" }, { status: 400 });
    }
    sourceUrl = parsedUrl.canonicalUrl;
  }

  try {
    const id = await createEmptySession({ speakerName, speakerLocation, mode, sourceUrl });
    log.debug("created", { id, mode });
    return NextResponse.json({ id, mode });
  } catch (err) {
    log.error("create failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
