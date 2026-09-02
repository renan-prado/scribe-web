import "server-only";
import { ensurePartnerAllowance } from "@/lib/partners/allowance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export async function getCurrentPartner(): Promise<CurrentPartner | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  // Service-role porque a policy de SELECT em `partners` exige
  // `user_id = auth.uid()` — e no primeiro acesso o vínculo ainda não existe,
  // então a própria consulta que o resolveria voltaria vazia.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partners")
    .select(SELECT)
    .or(`user_id.eq.${user.id},invited_email.ilike.${user.email}`)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;

  // Primeira visita: grava o vínculo para as próximas leituras passarem pela
  // policy normal, sem depender deste casamento por e-mail.
  if (!data.user_id) {
    const { error: linkErr } = await admin
      .from("partners")
      .update({ user_id: user.id })
      .eq("id", data.id)
      .is("user_id", null);
    if (linkErr) {
      console.error("[partners] falha ao vincular parceiro à conta", {
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
}

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
