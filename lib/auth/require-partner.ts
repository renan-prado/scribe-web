import "server-only";
import { cache } from "react";
import { escapeLikeValue } from "@/lib/db/like";
import { createLogger } from "@/lib/log";
import { ensurePartnerAllowance } from "@/lib/partners/allowance";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

const log = createLogger("partners");

/**
 * Gate do painel do parceiro, irmão de `require-admin.ts`.
 *
 * Mora no layout da rota, não no proxy: um guard por papel no proxy custaria
 * uma consulta ao banco em TODA requisição do site para proteger uma área que
 * pouquíssimas pessoas visitam.
 *
 * O vínculo com a conta acontece aqui, na primeira visita, casando o e-mail
 * do convite com o e-mail do login. É o único momento em que sabemos as duas
 * coisas: o admin cadastra o parceiro antes de ele existir como usuário, e a
 * conta só ganha id quando a pessoa entra pela primeira vez.
 *
 * Duas entradas, uma resolução:
 *   - `getCurrentPartner()` — o painel. Tudo que a tela mostra.
 *   - `getPartnerNavLink()` — o menu do avatar dentro do app, que só precisa
 *     saber SE mostra o item. Vem da mesma consulta porque a linha é uma só e
 *     buscá-la parcialmente não economizaria nada.
 *
 * Memoizada com `cache()` por render pass. O layout de `/partners` e a página
 * dentro dele chamavam os dois — o comentário na página dizia "reaproveita a
 * resolução", e não reaproveitava: eram duas rodadas completas, com dois
 * `getUser()`, duas consultas service-role e duas conferências de mesada.
 * Agora é uma. O efeito colateral (vincular a conta na primeira visita,
 * creditar a mesada) também passa a acontecer uma vez por request, que é o
 * que sempre se quis.
 */

export type CurrentPartner = {
  id: string;
  slug: string;
  displayName: string;
  commissionRateBps: number;
  signupBonusCoins: number;
  monthlyCoins: number;
  pixKey: string | null;
};

const SELECT =
  "id, user_id, slug, display_name, commission_rate_bps, signup_bonus_coins, monthly_coins, allowance_month, pix_key";

export const getCurrentPartner = cache(async (): Promise<CurrentPartner | null> => {
  const user = await getAuthUser();
  if (!user?.email) return null;

  // Service-role porque a policy de SELECT em `partners` exige
  // `user_id = auth.uid()` — e no primeiro acesso o vínculo ainda não existe,
  // então a própria consulta que o resolveria voltaria vazia.
  const admin = createAdminClient();

  // DUAS consultas, e não um `.or()` com o e-mail interpolado na string do
  // filtro. A forma antiga montava `invited_email.ilike.${user.email}` à mão,
  // o que além do curinga acima deixava a sintaxe do PostgREST (vírgula,
  // parêntese) ao alcance do valor. Separadas, cada uma diz uma coisa só — e a
  // segunda passa a exigir `user_id is null`, que a versão com `.or()` não
  // exigia: um parceiro JÁ vinculado a outra conta, cujo `invited_email`
  // coincidisse com o meu, voltava para mim e me mostrava o painel dele.
  const byUser = await admin
    .from("partners")
    .select(SELECT)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (byUser.error) return null;

  const byEmail = byUser.data
    ? null
    : await admin
        .from("partners")
        .select(SELECT)
        // `invited_email` é gravado como o admin digitou (unicidade por
        // `lower(...)`, migração 0029), daí o `ilike` — e daí o escape: sem ele
        // um e-mail com `%` casaria com QUALQUER parceiro, e esta consulta roda
        // com service-role. Ver `lib/db/like.ts`.
        .ilike("invited_email", escapeLikeValue(user.email))
        .is("user_id", null)
        .eq("status", "active")
        .maybeSingle();
  if (byEmail?.error) return null;

  const data = byUser.data ?? byEmail?.data ?? null;
  if (!data) return null;

  // Primeira visita: grava o vínculo para as próximas leituras passarem pela
  // policy normal, sem depender deste casamento por e-mail.
  if (!data.user_id) {
    const { error: linkErr } = await admin
      .from("partners")
      .update({ user_id: user.id })
      .eq("id", data.id)
      .is("user_id", null);
    if (linkErr) {
      log.error("falha ao vincular parceiro à conta", {
        partnerId: data.id,
        error: linkErr.message,
      });
    }
  }

  // A mesada é conferida aqui porque este é o único ponto por onde todo
  // parceiro passa — o painel e o menu do app chamam os dois esta resolução.
  // O `allowance_month` da linha que acabamos de ler decide, sem ida extra ao
  // banco no caso normal (já creditado neste mês).
  await ensurePartnerAllowance({
    partnerId: data.id,
    userId: user.id,
    monthlyCoins: data.monthly_coins ?? 0,
    allowanceMonth: (data.allowance_month as string | null) ?? null,
  });

  return {
    id: data.id,
    slug: data.slug,
    displayName: data.display_name,
    commissionRateBps: data.commission_rate_bps,
    signupBonusCoins: data.signup_bonus_coins,
    monthlyCoins: data.monthly_coins ?? 0,
    pixKey: data.pix_key,
  };
});

/**
 * `true` quando a conta logada é de um parceiro ativo — o que o menu do avatar
 * precisa saber para oferecer "Área do parceiro".
 *
 * Sem isso o parceiro só chega ao painel digitando a URL, que é como ele
 * estava chegando: o admin manda o link uma vez, e depois disso a área some
 * do mundo dele.
 */
export async function isCurrentUserPartner(): Promise<boolean> {
  return (await getCurrentPartner()) !== null;
}
