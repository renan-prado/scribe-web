import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createCategory, listCategories } from "@/lib/db/admin/finance";
import { CategoryInputSchema } from "@/lib/domain/finance";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  try {
    return NextResponse.json({ categories: await listCategories() });
  } catch (err) {
    log.error("list categories failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, CategoryInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const category = await createCategory(parsed.data);
    log.info("category created", { id: category.id, slug: category.slug, by: auth.user.id });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    // O slug sai do nome, então dois nomes que normalizam igual colidem. É
    // erro do operador ("Impostos" já existe), e o 409 diz isso.
    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "category_exists" }, { status: 409 });
    }
    log.error("create category failed", { error: message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
