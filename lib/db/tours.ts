import "server-only";
import { isTourKey, TOURS, type TourKey, type TourSeenMap } from "@/lib/domain/tour";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quem já viu qual tour, e o registro de quem começou, terminou ou fugiu.
 *
 * Tudo roda com service-role e recebe o `userId` de quem chama: `user_tours`
 * (0051) tem RLS ligada e nenhuma policy, de propósito. O cabeçalho da
 * migração diz por quê, e o resumo é que a taxa de conclusão por tour é um
 * número que NÓS lemos para decidir o que reescrever.
 *
 * A regra que governa este arquivo: **quem decide se o tour aparece é o
 * servidor, e a decisão é gravada no instante em que ele aparece.** O cliente
 * tem uma cópia do mapa para não pedir nada quando não há o que mostrar, mas
 * a palavra final é o `claimTour` abaixo, que é quem resolve duas abas
 * abertas na mesma tela.
 */

const log = createLogger("tour");

type Row = {
  tour: string;
  version: number | null;
};

/**
 * O mapa "tour → versão já vista" do usuário, lido UMA vez no layout de
 * `(app)` e entregue ao navegador.
 *
 * Ele existe para o caso comum, que é não ter tour nenhum a mostrar: sem o
 * mapa, toda visita a toda tela com tour faria uma chamada de rede para ouvir
 * "não". Com ele, quem já viu tudo não fala com o servidor.
 *
 * Falha devolve mapa VAZIO, e essa escolha tem consequência: um erro de
 * leitura faria o cliente achar que ninguém viu nada. Quem impede a
 * repetição, aí, é o `claimTour`, que confere de novo antes de a tela
 * desenhar qualquer coisa. É a mesma razão de a conferência ser feita duas
 * vezes.
 */
export async function listSeenTours(userId: string): Promise<TourSeenMap> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_tours")
    .select("tour, version")
    .eq("user_id", userId);

  if (error) {
    log.warn("mapa não lido", { userId, error: error.message });
    return {};
  }

  const seen: TourSeenMap = {};
  for (const row of (data ?? []) as Row[]) {
    // Chave que não existe mais em `lib/domain/tour.ts` é linha órfã de um
    // tour aposentado: ignorada aqui, e inofensiva no banco.
    if (!isTourKey(row.tour)) continue;
    seen[row.tour] = row.version ?? 1;
  }
  return seen;
}

/**
 * "Posso mostrar este tour agora?". Quando a resposta é sim, ela JÁ VEIO
 * gravada.
 *
 * Gravar antes de mostrar é o que faz o tour não voltar quando a pessoa
 * recarrega a página, e é a mesma inversão do `feedback_prompts` (0047). O
 * preço está pago e é conhecido: quem fecha a aba no primeiro passo não vê o
 * resto, e o troco é o "Rever os tours" do /profile (`resetTours`).
 *
 * As três respostas do banco, e o que cada uma significa:
 *
 *   * linha inexistente → insere e mostra;
 *   * linha com versão IGUAL ou MAIOR → já viu esta versão, não mostra;
 *   * linha com versão MENOR → os passos mudaram desde que ela viu; a linha é
 *     reescrita do zero e o tour roda de novo.
 *
 * O `23505` do insert não é erro: é a outra aba tendo chegado primeiro.
 */
export async function claimTour(input: { userId: string; tour: TourKey }): Promise<boolean> {
  const { userId, tour } = input;
  const version = TOURS[tour].version;
  const admin = createAdminClient();

  const { data: existing, error: readError } = await admin
    .from("user_tours")
    .select("version")
    .eq("user_id", userId)
    .eq("tour", tour)
    .maybeSingle();

  if (readError) {
    log.warn("leitura falhou, sem tour", { userId, tour, error: readError.message });
    return false;
  }

  if (existing) {
    const seenVersion = (existing.version as number | null) ?? 1;
    if (seenVersion >= version) return false;

    const { error } = await admin
      .from("user_tours")
      .update({
        version,
        started_at: new Date().toISOString(),
        completed_at: null,
        dismissed_at: null,
        last_step: 0,
      })
      .eq("user_id", userId)
      .eq("tour", tour);
    if (error) {
      log.warn("revisão não gravada, sem tour", { userId, tour, error: error.message });
      return false;
    }
    log.debug("tour revisado", { tour, version });
    return true;
  }

  const { error } = await admin
    .from("user_tours")
    .insert({ user_id: userId, tour, version, last_step: 0 });

  if (error) {
    // 23505: a outra aba ganhou a corrida. Não é erro, é a garantia
    // funcionando, e o "não" daqui é o que impede o mesmo tour de abrir duas
    // vezes na mesma cara.
    if (error.code !== "23505") {
      log.warn("registro falhou, sem tour", { userId, tour, error: error.message });
    }
    return false;
  }

  log.debug("tour aberto", { tour, version });
  return true;
}

/**
 * O desfecho. `completed` é quem chegou ao fim; `dismissed` é quem fechou no
 * meio, e o `step` é ONDE.
 *
 * Nenhum dos dois muda se o tour volta, isso já foi decidido pelo `claimTour`
 * quando a linha nasceu. Os dois existem para a pergunta que só se responde
 * depois: um tour abandonado em massa no passo 2 não precisa de mais um
 * passo, precisa que aquele passo saia.
 */
export async function finishTour(input: {
  userId: string;
  tour: TourKey;
  step: number;
  outcome: "completed" | "dismissed";
}): Promise<void> {
  const { userId, tour, step, outcome } = input;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("user_tours")
    .update({
      last_step: Math.max(0, Math.trunc(step)),
      completed_at: outcome === "completed" ? now : null,
      dismissed_at: outcome === "dismissed" ? now : null,
    })
    .eq("user_id", userId)
    .eq("tour", tour);

  if (error) log.warn("desfecho não gravado", { userId, tour, error: error.message });
}

/**
 * "Rever os tours" do /profile: apaga TODAS as linhas da pessoa.
 *
 * É o troco de duas decisões desta pasta, e por isso não é um extra. A
 * primeira é gravar antes de mostrar, que deixa de fora quem recarregou a
 * página no meio. A segunda é ser uma vez na vida: quem voltou ao produto
 * depois de seis meses não tem outro jeito de rever a explicação.
 *
 * Apaga tudo de uma vez, e não tour a tour, porque a pergunta de quem clica
 * nunca é "quero rever o da Biblioteca": é "me mostra de novo".
 */
export async function resetTours(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("user_tours").delete().eq("user_id", userId);
  if (error) throw new Error(`resetTours failed: ${error.message}`);
}
