import { NextResponse } from "next/server";
import { z } from "zod";
import { type FeedOrder, listFeedEntries } from "@/lib/db/feed-entries";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OrderSchema = z.enum(["recent", "oldest"]).default("recent");
const OffsetSchema = z.coerce.number().int().min(0).max(10_000).default(0);
const LimitSchema = z.coerce.number().int().min(1).max(50).default(10);

/**
 * GET /api/feed?order=recent|oldest&offset=0&limit=10&excludeSessionId=...
 *
 * Feed unificado (praticar/releia/lembra) de todas as sessões do usuário.
 * Só entram cards cuja data agendada (createdAt + dayOffset) já venceu.
 *
 * O caller recebe items + hasMore + total; `X-Total-Count` também vai no
 * header pra permitir HEAD-like sniffing sem parsear body.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["feed-read"], auth.user.id);
  if (limited) return limited;

  const url = new URL(request.url);
  const orderRaw = url.searchParams.get("order");
  const offsetRaw = url.searchParams.get("offset");
  const limitRaw = url.searchParams.get("limit");
  const excludeSessionId = url.searchParams.get("excludeSessionId");

  const orderParsed = OrderSchema.safeParse(orderRaw ?? undefined);
  const offsetParsed = OffsetSchema.safeParse(offsetRaw ?? undefined);
  const limitParsed = LimitSchema.safeParse(limitRaw ?? undefined);

  if (!orderParsed.success || !offsetParsed.success || !limitParsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const order: FeedOrder = orderParsed.data;
  const offset = offsetParsed.data;
  const limit = limitParsed.data;

  try {
    const now = new Date();
    const result = await listFeedEntries({
      order,
      offset,
      limit,
      now,
      excludeSessionId: excludeSessionId?.trim() || null,
    });
    devLog("[feed] ok", {
      order,
      offset,
      limit,
      total: result.total,
      returned: result.items.length,
    });
    return NextResponse.json(
      { items: result.items, hasMore: result.hasMore, total: result.total },
      { headers: { "X-Total-Count": String(result.total) } }
    );
  } catch (err) {
    console.error("[feed] failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
