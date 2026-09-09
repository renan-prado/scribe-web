import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { deleteScenario, updateScenario } from "@/lib/db/admin/finance";
import { ScenarioInputSchema } from "@/lib/domain/finance";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = ScenarioInputSchema.partial();

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
    return NextResponse.json({ scenario: await updateScenario(guarded.id, parsed.data) });
  } catch (err) {
    log.error("update scenario failed", { id: guarded.id, error: (err as Error).message });
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
    await deleteScenario(guarded.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("delete scenario failed", { id: guarded.id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
