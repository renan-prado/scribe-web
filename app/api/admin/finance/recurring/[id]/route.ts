import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { deleteRecurring, updateRecurring } from "@/lib/db/admin/finance";
import { RecurringPatchSchema } from "@/lib/domain/finance";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = RecurringPatchSchema;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  const parsed = await parseJsonBody(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const recurring = await updateRecurring(guarded.id, parsed.data);
    log.info("recurring updated", {
      id: guarded.id,
      fields: Object.keys(parsed.data),
      by: auth.user.id,
    });
    return NextResponse.json({ recurring });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("23514")) {
      return NextResponse.json({ error: "invalid_period" }, { status: 409 });
    }
    log.error("update recurring failed", { id: guarded.id, error: message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * Apagar um contrato NÃO apaga os lançamentos que ele gerou: a FK é
 * `on delete set null`, então as faturas já lançadas continuam contando e só
 * perdem o vínculo. É o comportamento certo — cancelar a Vercel não desfaz os
 * dez meses que já foram pagos. Para tirar o custo do futuro sem perder o
 * histórico, o caminho é marcar `status = 'cancelled'`, e é o que a tela
 * oferece primeiro.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  try {
    await deleteRecurring(guarded.id);
    log.info("recurring deleted", { id: guarded.id, by: auth.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("delete recurring failed", { id: guarded.id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
