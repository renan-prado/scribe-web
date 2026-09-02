import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { updatePartner } from "@/lib/db/admin/partners";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { PartnerBodySchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = PartnerBodySchema.partial();

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
    const partner = await updatePartner(guarded.id, parsed.data);
    // A taxa é o único campo aqui que mexe em dinheiro. Fica em `info` para
    // haver rastro de quando mudou: as comissões antigas guardam a taxa
    // vigente na época e, por isso mesmo, não denunciam a alteração.
    if (parsed.data.commissionRateBps !== undefined) {
      console.info("[admin/partners] commission rate changed", {
        id: guarded.id,
        rateBps: parsed.data.commissionRateBps,
        by: auth.user.id,
      });
    }
    devLog("[admin/partners] updated", { id: guarded.id, fields: Object.keys(parsed.data) });
    return NextResponse.json({ partner });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "slug_or_email_taken" }, { status: 409 });
    }
    console.error("[admin/partners] update failed", { id: guarded.id, error: message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
