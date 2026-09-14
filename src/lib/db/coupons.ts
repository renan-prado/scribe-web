import "server-only";
import type { AdminCoupon, CouponCreateInput } from "@/lib/domain/coupon";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Os cupons de cadastro: emissão e leitura pelo admin, resgate no login.
 *
 * Tudo aqui é service-role, e isso não é atalho: as duas tabelas da migração
 * 0055 têm RLS ligada e NENHUMA policy, então não existe caminho do cliente até
 * elas. Quem chama é `/api/admin/coupons` (atrás de `requireAdmin()`), o
 * `/auth/callback` (que resgata) e a tela de entrada (que mostra quanto o
 * convite vale).
 *
 * **A regra do resgate mora inteira na RPC** (janela de conta nova, cupom
 * inativo, expirado, esgotado, uma vez por pessoa, e o crédito por
 * `grant_coins`). Aqui só traduzimos o resultado. Reescrever qualquer pedaço
 * dela em TypeScript seria a segunda definição da mesma regra, e a que não roda
 * dentro da transação.
 */

const log = createLogger("db/coupons");

export type RedeemResult =
  | "ok"
  | "unknown_code"
  | "inactive"
  | "expired"
  | "exhausted"
  | "already_redeemed"
  | "not_new"
  | "error";

export async function redeemSignupCoupon(userId: string, code: string): Promise<RedeemResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_signup_coupon", {
    p_user_id: userId,
    p_code: code,
  });
  if (error) {
    log.error("resgate falhou", { code, error: error.message });
    return "error";
  }
  return (data as RedeemResult) ?? "error";
}

/**
 * O que a TELA DE ENTRADA pode dizer sobre o cupom do cookie: quanto ele vale,
 * e só. Nunca o teto, nunca quantos já usaram, nunca o rótulo interno.
 *
 * Devolve `null` quando o cupom não existe, foi desativado, expirou ou acabou.
 * Anunciar um bônus que `redeem_signup_coupon` vai recusar é prometer moeda que
 * não será creditada, e a pessoa descobre isso depois de criar a conta.
 *
 * A contagem é `head: true` com `count: "exact"`: a resposta é um número, e não
 * as linhas, uma tela pública não tem por que carregar quem resgatou o quê.
 */
export async function getCouponPublicByCode(
  code: string
): Promise<{ code: string; coins: number } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signup_coupons")
    .select("code, coins, max_redemptions, expires_at, is_active")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && Date.parse(data.expires_at as string) < Date.now()) return null;

  const { count } = await admin
    .from("signup_coupon_redemptions")
    .select("user_id", { count: "exact", head: true })
    .eq("code", code);
  if ((count ?? 0) >= (data.max_redemptions as number)) return null;

  return { code: data.code as string, coins: data.coins as number };
}

/**
 * A lista do painel, com o número de resgates de cada cupom.
 *
 * Duas consultas e uma contagem em memória, não um join: o PostgREST só faria o
 * embed pela FK, e trazer as linhas de resgate para contá-las traria junto o
 * `user_id` de cada pessoa, que esta tela não mostra e não precisa. São dezenas
 * de cupons, não milhares.
 */
export async function listCoupons(): Promise<AdminCoupon[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("signup_coupons")
    .select("code, coins, label, max_redemptions, expires_at, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !rows) {
    if (error) log.warn("listagem falhou", { error: error.message });
    return [];
  }

  const { data: redemptions } = await admin.from("signup_coupon_redemptions").select("code");
  const used = new Map<string, number>();
  for (const r of redemptions ?? []) {
    const code = r.code as string;
    used.set(code, (used.get(code) ?? 0) + 1);
  }

  return rows.map((r) => ({
    code: r.code as string,
    coins: r.coins as number,
    label: (r.label as string | null) ?? null,
    maxRedemptions: r.max_redemptions as number,
    expiresAt: (r.expires_at as string | null) ?? null,
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
    redemptions: used.get(r.code as string) ?? 0,
  }));
}

/** Devolve `"duplicate"` quando o código já existe: é o 23505 do PK. */
export async function createCoupon(
  input: CouponCreateInput,
  adminId: string
): Promise<"ok" | "duplicate" | "error"> {
  const admin = createAdminClient();
  const { error } = await admin.from("signup_coupons").insert({
    code: input.code,
    coins: input.coins,
    label: input.label?.trim() || null,
    max_redemptions: input.maxRedemptions,
    expires_at: input.expiresAt ?? null,
    created_by: adminId,
  });
  if (error) {
    if (error.code === "23505") return "duplicate";
    log.error("criação falhou", { code: input.code, error: error.message });
    return "error";
  }
  log.info("cupom criado", {
    code: input.code,
    coins: input.coins,
    maxRedemptions: input.maxRedemptions,
  });
  return "ok";
}

export async function setCouponActive(code: string, isActive: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("signup_coupons")
    .update({ is_active: isActive })
    .eq("code", code);
  if (error) throw new Error(`setCouponActive failed: ${error.message}`);
  log.info("cupom alternado", { code, isActive });
}

/**
 * Apaga um cupom que NUNCA foi resgatado.
 *
 * Quem recusa o resto é o banco: `signup_coupon_redemptions.code` é
 * `on delete restrict`, então apagar um cupom usado é um 23503, e o painel
 * traduz isso para "desative em vez de apagar". A escolha é a mesma das
 * categorias do financeiro: o que já produziu efeito não se apaga, porque
 * apagá-lo deixaria um crédito de moedas sem explicação no extrato de alguém.
 */
export async function deleteCoupon(code: string): Promise<"ok" | "in_use" | "error"> {
  const admin = createAdminClient();
  const { error } = await admin.from("signup_coupons").delete().eq("code", code);
  if (error) {
    if (error.code === "23503") return "in_use";
    log.error("exclusão falhou", { code, error: error.message });
    return "error";
  }
  log.info("cupom apagado", { code });
  return "ok";
}
