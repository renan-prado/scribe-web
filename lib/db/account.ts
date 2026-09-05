import "server-only";
import { cache } from "react";
import { INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import type { Profile } from "@/lib/domain/profile";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * A linha de `profiles` do usuário corrente, lida UMA vez por request.
 *
 * Existe porque três perguntas diferentes — "quem é essa pessoa?", "quanto
 * ela tem de saldo?" e "ela é admin?" — moravam em três módulos e viravam
 * três SELECTs na MESMA linha, cada um precedido de um `getUser()` próprio.
 * O layout de `(app)` fazia os três em todo page view, e a página fazia o
 * primeiro de novo.
 *
 * Só o SELECT é combinado. `getCurrentProfile`, `getCurrentBalance` e
 * `isCurrentUserAdmin` continuam existindo com a assinatura de sempre e
 * agora leem daqui — quem chama não precisou mudar, e o gate de admin não
 * ficou mais frouxo por passar a compartilhar a consulta.
 *
 * As colunas `role`, `is_active` e `coin_balance` são LEGÍVEIS pelo próprio
 * dono (a policy `profiles_select_own` de 0005 escopa por `auth.uid()`); o
 * que a migração 0026 restringiu por coluna foi o UPDATE, não o SELECT.
 */

export type CurrentAccount = {
  profile: Profile;
  coinBalance: number;
  isAdmin: boolean;
  /**
   * `false` só quando um admin desativou a conta. É o que os layouts de
   * `(app)` e `/partners` conferem para barrar a navegação — o equivalente,
   * do lado das páginas, ao 403 que `requireAuth()` devolve nas rotas.
   */
  isActive: boolean;
};

const SELECT = "id, display_name, avatar_url, email, created_at, coin_balance, role, is_active";

type DbRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  coin_balance: number | null;
  role: string | null;
  is_active: boolean | null;
};

export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`getCurrentAccount failed: ${error.message}`);
  if (!data) return null;

  const row = data as DbRow;
  return {
    profile: {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      createdAt: row.created_at,
    },
    coinBalance: row.coin_balance ?? INITIAL_COIN_BALANCE,
    isAdmin: row.role === "admin" && row.is_active !== false,
    // `!== false` e não `=== true`: null (linha antiga, coluna recém-criada)
    // é conta ativa. Só a desativação explícita barra alguém.
    isActive: row.is_active !== false,
  };
});
