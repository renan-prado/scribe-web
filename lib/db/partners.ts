import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Acesso ao schema de parceiros (migração 0029).
 *
 * Tudo aqui passa pelo service-role: as duas funções do banco têm EXECUTE
 * revogado de `anon`/`authenticated`, exatamente como `grant_coins`. Mesmo
 * padrão de `lib/db/billing.ts` — o servidor é a única porta.
 */

/**
 * Resultado de `attach_partner`. Só `ok` credita bônus; os demais são
 * recusas NORMAIS, e nenhuma delas pode quebrar o login:
 *
 *   already_attributed — a conta já pertence a um parceiro (o vínculo é
 *                        permanente, e o primeiro vale)
 *   not_new            — conta antiga demais; um usuário de meses atrás
 *                        abrindo um link não vira indicação (nem ganha bônus)
 *   unknown_slug       — link velho, código digitado errado, parceiro suspenso
 *   self_referral      — o parceiro usando o próprio link
 */
export type AttachPartnerResult =
  | "ok"
  | "already_attributed"
  | "not_new"
  | "unknown_slug"
  | "self_referral";

const ATTACH_RESULTS: readonly string[] = [
  "ok",
  "already_attributed",
  "not_new",
  "unknown_slug",
  "self_referral",
];

/**
 * Vincula um usuário recém-criado a um parceiro e credita o bônus de
 * indicação. Idempotente pelo lado do banco (o vínculo só é gravado quando
 * `partner_id` está nulo, e o bônus passa por `grant_coins` com
 * `external_ref` único).
 *
 * NÃO lança. Uma falha aqui vira `unknown_slug` e um log: o usuário está no
 * meio do login, e perder um bônus é ruim, mas não entrar no app é pior.
 */
export async function attachPartner(args: {
  userId: string;
  slug: string;
  source: "link" | "code";
}): Promise<AttachPartnerResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_partner", {
    p_user_id: args.userId,
    p_slug: args.slug,
    p_source: args.source,
  });
  if (error) {
    console.error("[partners] attach_partner failed", {
      userId: args.userId,
      slug: args.slug,
      error: error.message,
    });
    return "unknown_slug";
  }
  return ATTACH_RESULTS.includes(data as string) ? (data as AttachPartnerResult) : "unknown_slug";
}

/**
 * Contabiliza uma visita ao link do parceiro. `unique` distingue "abriu de
 * novo" de "pessoa diferente" — sem isso, um link em stories reaberto pela
 * mesma pessoa infla o topo do funil e o painel do parceiro vira ficção.
 *
 * Slug desconhecido é ignorado em silêncio pela própria função do banco.
 */
export async function recordPartnerClick(slug: string, unique: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_partner_click", {
    p_slug: slug,
    p_unique: unique,
  });
  if (error) {
    // Contador de métrica: registrar é melhor do que falhar, mas um erro aqui
    // nunca pode atrapalhar o redirect que leva a pessoa à landing page.
    console.error("[partners] record_partner_click failed", { slug, error: error.message });
  }
}
