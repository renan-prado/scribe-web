import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { deleteEntry, updateEntry } from "@/lib/db/admin/finance";
import { EntryPatchSchema } from "@/lib/domain/finance";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `EntryPatchSchema` é o objeto CRU parcial com o refinamento reaplicado numa
 * versão tolerante a campos ausentes, no Zod 4, `.partial()` sobre um schema
 * já refinado lança no import. Ver o cabeçalho em `lib/domain/finance.ts`.
 */
const PatchSchema = EntryPatchSchema;

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
    const entry = await updateEntry(guarded.id, parsed.data);
    log.info("entry updated", {
      id: guarded.id,
      fields: Object.keys(parsed.data),
      by: auth.user.id,
    });
    return NextResponse.json({ entry });
  } catch (err) {
    const message = (err as Error).message;
    // O CHECK de "pago ≤ valor" e o de "liquidado precisa de data" chegam aqui
    // como 23514. É erro do operador, não do sistema: um 409 com motivo
    // próprio evita que vire o "algo deu errado" genérico.
    if (message.includes("23514")) {
      return NextResponse.json({ error: "invalid_entry_state" }, { status: 409 });
    }
    log.error("update entry failed", { id: guarded.id, error: message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;

  try {
    await deleteEntry(guarded.id);
    log.info("entry deleted", { id: guarded.id, by: auth.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("delete entry failed", { id: guarded.id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
