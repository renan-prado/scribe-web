"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/require-admin";
import { declineProspect } from "@/lib/db/prospects";

/**
 * O `assertAdmin()` é a autorização REAL desta action. Ela viver num componente
 * dentro de `/admin` não protege nada: uma Server Action é um POST próprio, e o
 * id dela é um hash estável embutido no bundle do cliente. Mesmo cuidado de
 * `lib/coins/settings-actions.ts` e `lib/fx/actions.ts`.
 *
 * Descartar não apaga nem devolve moeda: a linha fica, com `status = 'declined'`.
 * O crédito já aconteceu e é imutável no ledger, e o registro de quem se
 * interessou continua valendo, inclusive para não creditar de novo a mesma
 * pessoa, que é garantido pelo PRIMARY KEY da tabela.
 */
export async function declineProspectAction(userId: string): Promise<void> {
  await assertAdmin();
  await declineProspect(userId);
  revalidatePath("/admin/partners");
}
