import "server-only";
import { getCurrentAccount } from "@/lib/db/account";
import type { Profile } from "@/lib/domain/profile";

/**
 * Profile is the app-side mirror of an auth.users row. The row is
 * auto-created by a trigger on auth.users insert (see migration 0005), so
 * reads here always find a row for a signed-in user.
 *
 * A leitura em si mora em `lib/db/account.ts`, que traz perfil, saldo e papel
 * na mesma linha — eram três SELECTs na mesma linha de `profiles`, cada um
 * com o seu próprio `getUser()`. Ver o cabeçalho de lá.
 */

/** Current auth user's profile row, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const account = await getCurrentAccount();
  return account?.profile ?? null;
}
