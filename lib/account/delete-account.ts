import "server-only";
import { getStripe } from "@/lib/billing/stripe";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("account.delete");

/**
 * Exclusão da própria conta, o motor por trás de `/profile/delete`.
 *
 * Quem apaga é `auth.admin.deleteUser`, o MESMO caminho do /admin/users: todo
 * conteúdo do usuário pendura em `auth.users` por `on delete cascade`
 * (sessões, transcrições, resumos, estudos, cards do feed, marcações,
 * lembretes, feedbacks, tours, recompensas de indicação, cupom de convite), e
 * a contabilidade sobrevive anonimizada por `on delete set null` (migração
 * 0056). Não existe aqui uma lista de tabelas a limpar, e isso é proposital:
 * uma lista em TypeScript envelhece calada a cada tabela nova, o banco não.
 *
 * **A ordem é assinatura PRIMEIRO, conta depois, e ela é a regra desta
 * função.** Apagar quem tem assinatura viva no Stripe sem cancelá-la é
 * continuar cobrando alguém que não existe mais: a fatura seguinte seria paga,
 * o webhook chegaria com um `customer` que `findUserIdByCustomerId` não
 * resolve, e o crédito não teria dono. Por isso um cancelamento que falha
 * ABORTA a exclusão inteira, em vez de seguir em frente: uma conta viva que a
 * pessoa tenta apagar de novo daqui a um minuto é um problema recuperável,
 * uma cobrança órfã não é.
 *
 * O cancelamento é IMEDIATO, não no fim do período. Deixar `cancel_at_period_
 * end` seria manter uma assinatura pendurada num usuário que já foi apagado,
 * exatamente o estado que o parágrafo acima evita. A tela avisa que não há
 * reembolso do período em curso.
 *
 * **O Customer do Stripe NÃO é apagado.** Ele é o que amarra as faturas já
 * emitidas ao pagamento que as quitou, e nota fiscal tem prazo legal de
 * guarda, a hipótese que a própria `/privacy` (§12) ressalva. O que o produto
 * sabe sobre a pessoa some daqui; o recibo fica onde recibo tem de ficar.
 */

type SubscriptionRow = {
  stripe_subscription_id: string | null;
  status: string | null;
};

/** Status do Stripe em que já não há nada a cancelar. */
const DEAD_STATUSES = new Set(["canceled", "incomplete_expired"]);

export async function deleteAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`deleteAccount: leitura da assinatura falhou: ${error.message}`);

  const row = (data ?? null) as SubscriptionRow | null;
  const subscriptionId = row?.stripe_subscription_id ?? null;
  const live = subscriptionId !== null && !DEAD_STATUSES.has(row?.status ?? "");

  if (live) {
    const stripe = getStripe();
    if (!stripe) {
      // Sem chave não há como cancelar, e seguir seria a cobrança órfã. Este
      // é o único caminho em que um ambiente sem Stripe configurado impede
      // uma operação que não é de cobrança, e é o desfecho correto.
      throw new Error("deleteAccount: assinatura viva e Stripe não configurado");
    }
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      log.info("assinatura cancelada antes da exclusão", { userId, subscriptionId });
    } catch (err) {
      // Assinatura que já não existe do lado do Stripe não é falha: o espelho
      // local é que estava velho. Qualquer outro erro aborta.
      const code = (err as { code?: string }).code;
      if (code !== "resource_missing") {
        throw new Error(
          `deleteAccount: cancelamento da assinatura falhou: ${(err as Error).message}`
        );
      }
      log.warn("assinatura já não existia no Stripe", { userId, subscriptionId });
    }
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) throw new Error(`deleteAccount: exclusão falhou: ${deleteErr.message}`);

  log.info("conta excluída pelo próprio usuário", { userId, hadSubscription: live });
}
