import { NextResponse } from "next/server";
import { listLocationsWithUsage } from "@/lib/db/locations";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("locations");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/locations?q=...
 * Returns the current user's locations, ordered by usage_count desc then name.
 * Case-insensitive substring search on `q`. Used by the location combobox.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["entity-search"], auth.user.id);
  if (limited) return limited;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.slice(0, 100) ?? undefined;

  try {
    const items = await listLocationsWithUsage({ q, limit: 25 });
    return NextResponse.json({
      items: items.map((l) => ({ id: l.id, name: l.name, count: l.usageCount })),
    });
  } catch (err) {
    log.error("list failed", { error: (err as Error).message });
    log.debug("list error");
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
