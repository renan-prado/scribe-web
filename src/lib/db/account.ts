import "server-only";
import { cache } from "react";
import { INITIAL_COIN_BALANCE } from "@/features/coins/pricing";
import { parseTranslation } from "@/lib/bibles/translations";
import type { Profile } from "@/lib/domain/profile";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * A linha de `profiles` do usuário corrente, lida UMA vez por request.
 *
 * Existe porque três perguntas diferentes, "quem é essa pessoa?", "quanto
 * ela tem de saldo?" e "ela é admin?", moravam em três módulos e viravam
 * três SELECTs na MESMA linha, cada um precedido de um `getUser()` próprio.
 * O layout de `(app)` fazia os três em todo page view, e a página fazia o
 * primeiro de novo.
 *
 * Só o SELECT é combinado. `getCurrentProfile`, `getCurrentBalance` e
 * `isCurrentUserAdmin` continuam existindo com a assinatura de sempre e
 * agora leem daqui, quem chama não precisou mudar, e o gate de admin não
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
   * `(app)` e `/partners/dashboard` conferem para barrar a navegação, o equivalente,
   * do lado das páginas, ao 403 que `requireAuth()` devolve nas rotas.
   */
  isActive: boolean;
  /**
   * Conta de Backoffice: uso interno. Gasta sem debitar saldo e fica fora de
   * toda medição do /admin. Só o admin marca (migração 0073).
   *
   * Ela viaja junto de `isAdmin` e não no lugar dele: são coisas diferentes e
   * ficariam erradas se fossem a mesma. Admin é quem ENTRA no painel; interna
   * é a conta que não deve APARECER nele. O admin que testa é as duas, e um
   * beta tester convidado pode precisar ser só a segunda.
   */
  isInternal: boolean;
};

const SELECT =
  "id, display_name, avatar_url, email, created_at, coin_balance, role, is_active, is_internal, bible_translation";

type DbRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  coin_balance: number | null;
  role: string | null;
  is_active: boolean | null;
  is_internal: boolean | null;
  bible_translation: string | null;
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
      // A coluna é `text` com CHECK (migração 0076), então o que chega aqui
      // já é uma das escolhíveis ou nulo. `parseTranslation` mesmo assim,
      // porque um valor gravado antes de um id sair do registro não pode virar
      // uma tradução que o loader não acha em disco.
      bibleTranslation: row.bible_translation ? parseTranslation(row.bible_translation) : null,
    },
    coinBalance: row.coin_balance ?? INITIAL_COIN_BALANCE,
    isAdmin: row.role === "admin" && row.is_active !== false,
    // `!== false` e não `=== true`: null (linha antiga, coluna recém-criada)
    // é conta ativa. Só a desativação explícita barra alguém.
    isActive: row.is_active !== false,
    // `=== true` e não `!== false`: o oposto de `isActive` logo acima, e de
    // propósito. Ali o default é permissivo (linha antiga é conta ativa);
    // aqui um null só pode significar "não marcada", e tratá-lo como interna
    // tiraria uma conta de cliente da medição sem ninguém pedir.
    isInternal: row.is_internal === true,
  };
});
