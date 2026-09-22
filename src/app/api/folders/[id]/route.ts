import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteFolder, getFolder, updateFolder } from "@/lib/db/folders";
import { FOLDER_COLORS } from "@/lib/domain/folder";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("folders");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.enum(FOLDER_COLORS).nullable().optional(),
  })
  .strict();

/** PATCH /api/folders/:id — renomeia e/ou troca a cor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  // Confere o dono ANTES de trabalhar, como o resto do repositório faz
  // (`app/AGENTS.md`): a RLS já escopa o UPDATE, mas sem esta leitura um id
  // alheio devolveria `{ ok: true }` mesmo sem mexer em linha nenhuma.
  const owned = await getFolder(id).catch(() => null);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await updateFolder(id, {
      name: parsed.data.name,
      color: parsed.data.color,
    });
    log.debug("updated", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    if (/duplicate key|23505/i.test(message)) {
      return NextResponse.json({ error: "name_taken" }, { status: 409 });
    }
    log.error("update failed", { id, error: message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

const DeleteSchema = z
  .object({
    /** `true` apaga também as sessões que estavam dentro; padrão é mover
     *  para a raiz (ver `deleteFolder` em `lib/db/folders.ts`). */
    deleteSessions: z.boolean().optional(),
  })
  .strict();

/** DELETE /api/folders/:id */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  // Body vazio é o caso comum ("mover para a raiz"); só tenta ler quando há
  // conteúdo, para não recusar uma chamada sem corpo com `invalid_json`.
  const hasBody = (request.headers.get("content-length") ?? "0") !== "0";
  let deleteSessions = false;
  if (hasBody) {
    const parsed = await parseJsonBody(request, DeleteSchema);
    if (!parsed.ok) return parsed.response;
    deleteSessions = parsed.data.deleteSessions ?? false;
  }

  const owned = await getFolder(id).catch(() => null);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await deleteFolder(id, deleteSessions);
    log.debug("deleted", { id, deleteSessions });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("delete failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
