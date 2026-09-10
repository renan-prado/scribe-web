import "server-only";
import { escapeLikeValue } from "@/lib/db/like";
import { PARTNER_PROSPECT_BUDGET_COINS, PARTNER_PROSPECT_COINS } from "@/lib/partners/economics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O pré-parceiro: quem chegou por `/parceiros`, criou conta sem compromisso e
 * ganha moedas para conhecer o produto antes de decidir se vai divulgá-lo.
 *
 * Toda a regra mora na RPC `attach_partner_prospect` (migração 0050), a janela
 * de conta nova, a recusa de quem já ganhou bônus por indicação, o teto global e
 * o crédito, tudo numa transação só. Aqui só passamos os dois números de
 * `economics.ts` e traduzimos o resultado.
 *
 * Os números viajam daqui para lá, e não estão gravados no schema, porque são
 * decisão de produto: mudar quanto vale o brinde não deveria exigir migração. A
 * função é service_role-only, então o valor sempre vem do nosso servidor.
 */

export type ProspectResult =
  | "ok"
  | "capped"
  | "already_prospect"
  | "already_partner"
  | "already_attributed"
  | "not_new"
  | "error";

export async function attachPartnerProspect(userId: string): Promise<ProspectResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_partner_prospect", {
    p_user_id: userId,
    p_coins: PARTNER_PROSPECT_COINS,
    p_budget_coins: PARTNER_PROSPECT_BUDGET_COINS,
  });
  if (error) return "error";
  return (data as ProspectResult) ?? "error";
}

export type AdminProspect = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  coinsGranted: number;
  status: "new" | "promoted" | "declined";
};

/**
 * A lista de candidatos do admin.
 *
 * Duas consultas em vez de um join porque `profiles` e `partner_prospects` são
 * lidas pelo service_role e o PostgREST só faria o embed com uma FK declarada
 * entre elas, que não existe de propósito: a chave de `partner_prospects` é
 * `auth.users`, não `profiles`.
 */
export async function listProspects(): Promise<AdminProspect[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("partner_prospects")
    .select("user_id, created_at, coins_granted, status")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !rows || rows.length === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in(
      "id",
      rows.map((r) => r.user_id as string)
    );

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return rows.map((r) => {
    const profile = byId.get(r.user_id as string);
    return {
      userId: r.user_id as string,
      email: (profile?.email as string | null) ?? null,
      displayName: (profile?.display_name as string | null) ?? null,
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      createdAt: r.created_at as string,
      coinsGranted: (r.coins_granted as number) ?? 0,
      status: (r.status as AdminProspect["status"]) ?? "new",
    };
  });
}

/**
 * Carimba os candidatos com este e-mail como promovidos.
 *
 * Chamado quando o admin CRIA um parceiro: se o e-mail do convite é o de alguém
 * que já tinha se cadastrado como pré-parceiro, aquela linha deixa de ser um
 * candidato pendente. Fazer isso aqui, e não num botão separado, é o que impede
 * a lista de candidatos de continuar mostrando gente que já virou parceiro,
 * um segundo passo manual seria esquecido exatamente nos dias corridos.
 *
 * Nunca lança: falhar em carimbar não pode derrubar a criação do parceiro, que
 * é a operação que importa.
 */
export async function markProspectsPromoted(email: string, partnerId: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    // `escapeLikeValue` porque `%` é curinga dentro de um ilike e esta consulta
    // roda com service-role: um e-mail com `%` casaria com QUALQUER perfil e
    // carimbaria o candidato errado como promovido. Mesma armadilha que
    // `require-partner.ts` já pagou.
    .ilike("email", escapeLikeValue(clean))
    .maybeSingle();
  if (!profile?.id) return;
  await admin
    .from("partner_prospects")
    .update({ status: "promoted", partner_id: partnerId, promoted_at: new Date().toISOString() })
    .eq("user_id", profile.id);
}

/** Descarta um candidato, some da lista de pendentes, a linha fica. */
export async function declineProspect(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("partner_prospects").update({ status: "declined" }).eq("user_id", userId);
}
