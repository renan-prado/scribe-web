import "server-only";
import type { TranslationId } from "@/lib/bibles/translations";
import { getCurrentAccount } from "@/lib/db/account";
import type { Profile } from "@/lib/domain/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile is the app-side mirror of an auth.users row. The row is
 * auto-created by a trigger on auth.users insert (see migration 0005), so
 * reads here always find a row for a signed-in user.
 *
 * A leitura em si mora em `lib/db/account.ts`, que traz perfil, saldo e papel
 * na mesma linha, eram três SELECTs na mesma linha de `profiles`, cada um
 * com o seu próprio `getUser()`. Ver o cabeçalho de lá.
 */

/** Current auth user's profile row, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const account = await getCurrentAccount();
  return account?.profile ?? null;
}

/**
 * Grava (ou apaga) a tradução bíblica preferida. `null` volta ao padrão do
 * produto, e é por isso que ele é um valor aceito e não a ausência de chamada.
 *
 * Escreve pelo client do USUÁRIO, não pelo service-role: a RLS de `profiles` já
 * limita o UPDATE à própria linha, e o `eq("id", userId)` é o cinto sobre o
 * suspensório. A coluna tem CHECK no banco (migração 0076), então um id fora da
 * lista é recusado pelo Postgres mesmo se passar por aqui.
 */
export async function setBibleTranslation(
  userId: string,
  translation: TranslationId | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ bible_translation: translation })
    .eq("id", userId);
  if (error) throw new Error(`setBibleTranslation failed: ${error.message}`);
}
