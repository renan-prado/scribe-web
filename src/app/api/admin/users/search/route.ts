import { NextResponse } from "next/server";
import { searchUsersForFilter } from "@/features/admin/server/db/user-search";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("admin/users/search");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/search?q=...
 *
 * O que alimenta o campo "Pessoa" dos filtros do painel, no lugar do `<select>`
 * com a base inteira dentro. Devolve no máximo 20 contas, sempre — com termo
 * ou sem ele (sem, são as mais recentes). Ver `server/db/user-search.ts`.
 *
 * Irmã de `/api/admin/users`, e deliberadamente NÃO a mesma rota: aquela monta
 * a ficha financeira de cada conta (duas varreduras de `coin_transactions`)
 * para a tabela de `/admin/users`. Um campo que dispara a cada tecla não pode
 * pagar isso, e nada do que ele mostra usa aquilo.
 *
 * O balde é o `admin` de sempre. Com o debounce de 200ms do campo, um digitar
 * humano corrido fica em ~5 chamadas por termo, bem abaixo dos 60/min.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);

  try {
    const users = await searchUsersForFilter(q);
    return NextResponse.json({ users });
  } catch (err) {
    log.error("search failed", { error: (err as Error).message });
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
