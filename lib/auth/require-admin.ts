import "server-only";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/db/account";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Returns `{ user, response: null }` on success,
 * or `{ user: null, response: 404 }` if the current request is not from
 * an admin. 404 (not 403) is intentional — do not confirm the existence
 * of admin surface area to unauthorized callers.
 */

type AdminResult =
  | { user: { id: string; role: "admin"; isActive: boolean }; response: null }
  | { user: null; response: NextResponse };

const NOT_FOUND = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, response: NOT_FOUND() };

  const { data, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return { user: null, response: NOT_FOUND() };
  if (data.role !== "admin" || data.is_active === false) {
    return { user: null, response: NOT_FOUND() };
  }
  return { user: { id: user.id, role: "admin", isActive: true }, response: null };
}

/**
 * Variante para Server Component / layout: só responde SE a conta é admin,
 * sem montar resposta HTTP — quem chama decide entre `notFound()` e esconder
 * um item de menu.
 *
 * Lê da mesma consulta memoizada que o perfil e o saldo (lib/db/account.ts),
 * então o gate do /admin e o item do menu do avatar não custam mais dois
 * SELECTs além dos que o layout já fazia. `requireAdmin()` acima segue com a
 * consulta própria de propósito: ele roda em Route Handler, onde `cache()`
 * não vale, e é o caminho que protege dinheiro — não divide estado com nada.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const account = await getCurrentAccount().catch(() => null);
  return account?.isAdmin ?? false;
}

/**
 * Gate para SERVER ACTION.
 *
 * Existe porque uma Server Action é um endpoint POST próprio: o gate do
 * `app/admin/layout.tsx` decide o que RENDERIZA, não o que executa. Quem
 * souber o id da action a invoca sem nunca ter passado pelo layout — e o id
 * é um hash estável, embutido no bundle, não um segredo. É o que a própria
 * documentação do Next diz em "Data Security": autenticação de página não
 * protege as actions dela, reconfira dentro de cada uma.
 *
 * Lança em vez de devolver 403 pelo mesmo motivo do 404 em `requireAdmin`:
 * não confirmamos a existência da área administrativa para quem não deveria
 * vê-la. O erro genérico que o Next devolve ao cliente não diz nada.
 */
export async function assertAdmin(): Promise<void> {
  if (await isCurrentUserAdmin()) return;
  throw new Error("not_found");
}
