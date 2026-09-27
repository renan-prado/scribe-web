"use server";

import { revalidatePath } from "next/cache";
import {
  markTesterSignupsInvited,
  undoTesterSignupInvite,
} from "@/features/admin/server/db/testers";
import { assertAdmin } from "@/lib/auth/require-admin";

/**
 * As duas escritas da tela de testadores, como Server Actions.
 *
 * **O `assertAdmin()` é a autorização de verdade das três**, e não o
 * `notFound()` do layout do painel: uma action é um endpoint POST próprio, e o
 * id dela é um hash estável embutido no bundle, não um segredo. É a regra do
 * `AGENTS.md` do admin, e o exemplo dela no repositório são as actions de
 * câmbio (`lib/fx/actions.ts`).
 *
 * São actions e não uma rota `/api/admin/testers` porque a tela não tem um
 * cliente que precise da resposta: o efeito de marcar alguém é a lista
 * redesenhada, que é exatamente o que o `revalidatePath` entrega. Uma rota
 * exigiria um `fetch`, um estado de carregando e um `router.refresh` para
 * chegar no mesmo lugar.
 */

export async function markTesterInvited(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await markTesterSignupsInvited([id]);
  revalidatePath("/admin/testers");
}

/**
 * Marca a fila INTEIRA, que é o gesto normal desta tela: os endereços vão ao
 * console em lote, num campo de texto separado por vírgula, então convidar é
 * quase sempre "todos os que estavam na lista que eu acabei de copiar".
 */
export async function markAllTestersInvited(): Promise<void> {
  await assertAdmin();
  await markTesterSignupsInvited();
  revalidatePath("/admin/testers");
}

export async function undoTesterInvited(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await undoTesterSignupInvite(id);
  revalidatePath("/admin/testers");
}
