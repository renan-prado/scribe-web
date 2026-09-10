import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createEntry, listEntries } from "@/lib/db/admin/finance";
import { EntryFiltersSchema, EntryInputSchema } from "@/lib/domain/finance";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/finance");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lançamentos financeiros.
 *
 * `requireAdmin()` primeiro e sempre, nas duas verbos. Não basta a área ser
 * invisível no menu: as tabelas de 0043 guardam margem, dívida e saldo em
 * caixa, e uma rota sem gate é alcançável por quem souber a URL. O 404 (não
 * 403) é a mesma decisão do resto do `/admin`, não confirmamos a existência
 * da área a quem não deveria vê-la.
 *
 * A escrita passa por `EntryInputSchema` inteiro. Cast e `typeof` na mão são
 * como um `amountCents` de `"1e309"` entra no banco e vira `Infinity` na
 * primeira soma da tela.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const url = new URL(request.url);
  const raw = Object.fromEntries(
    [...url.searchParams.entries()].filter(([, value]) => value !== "" && value !== "all")
  );
  const filters = EntryFiltersSchema.safeParse(raw);
  if (!filters.success) {
    return NextResponse.json({ error: "invalid_filters" }, { status: 400 });
  }

  try {
    const entries = await listEntries(filters.data);
    return NextResponse.json({ entries });
  } catch (err) {
    log.error("list entries failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, EntryInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const entry = await createEntry(parsed.data, auth.user.id);
    // `info` e não `debug`: é mutação de dinheiro por um admin, e o rastro de
    // quem lançou o quê é o que uma auditoria vai procurar.
    log.info("entry created", {
      id: entry.id,
      kind: entry.kind,
      amountCents: entry.amountCents,
      currency: entry.currency,
      by: auth.user.id,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    log.error("create entry failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
