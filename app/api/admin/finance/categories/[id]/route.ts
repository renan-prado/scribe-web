import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { updateCategory } from "@/lib/db/admin/finance";
import { CategoryInputSchema } from "@/lib/domain/finance";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = CategoryInputSchema.partial();

/**
 * Não existe DELETE aqui, e é deliberado. Apagar uma categoria deixaria os
 * lançamentos que apontavam para ela com `category_id` nulo, e sem categoria
 * um custo é tratado como VARIÁVEL por `lib/finance/aggregate.ts`, então
 * apagar "Infraestrutura" faria o custo fixo do histórico inteiro despencar
 * sem que nada indicasse por quê. O que a tela oferece é ARQUIVAR: some do
 * formulário, continua explicando o passado.
 */
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
    const category = await updateCategory(guarded.id, parsed.data);
    // A NATUREZA muda o que entra em "custo fixo" de todo o histórico, então
    // ela merece rastro próprio: sem isso, um relatório que mudou de forma
    // entre duas leituras não teria explicação em lugar nenhum.
    if (parsed.data.nature !== undefined) {
      log.info("category nature changed", {
        id: guarded.id,
        nature: parsed.data.nature,
        by: auth.user.id,
      });
    }
    return NextResponse.json({ category });
  } catch (err) {
    log.error("update category failed", { id: guarded.id, error: (err as Error).message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
