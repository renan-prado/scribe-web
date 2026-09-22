import { NextResponse } from "next/server";
import { z } from "zod";
import { createFolder, folderTreeError, listFolders } from "@/lib/db/folders";
import { FOLDER_COLORS } from "@/lib/domain/folder";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("folders");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/folders — todas as pastas do usuário.
 *
 * Sem paginação e sem busca: o acervo de PASTAS não tem a escala do de
 * sessões, é o mesmo raciocínio de `speakers`/`locations`.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-read"], auth.user.id);
  if (limited) return limited;

  const folders = await listFolders().catch((error: unknown) => {
    log.error("listFolders falhou", { error: String(error) });
    return null;
  });
  if (!folders) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({ folders });
}

const CreateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    color: z.enum(FOLDER_COLORS).nullable().optional(),
    /** A pasta mãe. Ausente ou `null` cria na raiz. */
    parentId: z.string().uuid().nullable().optional(),
  })
  .strict();

/** POST /api/folders — cria uma pasta nova. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, CreateFolderSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const folder = await createFolder({
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      parentId: parsed.data.parentId ?? null,
    });
    log.debug("created", { id: folder.id, parentId: folder.parentId });
    return NextResponse.json({ folder });
  } catch (err) {
    const message = (err as Error).message;
    const tree = folderTreeError(message);
    if (tree) return NextResponse.json({ error: tree }, { status: 409 });
    // Índice único (user_id, parent_id, lower(name)) — migrações 0068/0069.
    if (/duplicate key|23505/i.test(message)) {
      return NextResponse.json({ error: "name_taken" }, { status: 409 });
    }
    log.error("create failed", { error: message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
