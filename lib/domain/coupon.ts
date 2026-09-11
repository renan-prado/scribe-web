import { z } from "zod";

/**
 * O cupom de cadastro: um link que o admin emite para convidar alguém
 * nominalmente, e que credita moedas na conta criada por ele.
 *
 * Client-safe: o formulário do painel valida antes do submit com o MESMO
 * schema que a rota usa antes de escrever, e o `couponPath` monta o link que o
 * painel mostra para copiar. Nada aqui toca banco nem segredo.
 *
 * **Os limites moram aqui, não no formulário.** O CHECK da migração 0055 é a
 * tranca final (`coins <= 5000`, `max_redemptions <= 1000`), e estes números
 * são a mesma coisa dita onde a pessoa digita: um 50000 recusado pelo banco
 * chega à tela como "write_failed", que não ensina nada.
 */

/**
 * Formato do código, espelhando o CHECK de `signup_coupons.code` (e o mesmo do
 * slug de parceiro): minúsculas, `[a-z0-9-]`, de 3 a 32, sem começar nem
 * terminar em hífen.
 *
 * Ele aparece numa URL e é ditado ao telefone, então não é aleatório: quem
 * emite escreve "igreja-betel" e sabe, dois meses depois, para quem foi.
 *
 * Devolve `null` quando não é um código possível. `null` significa
 * "impossível", não "inexistente": quem decide se o cupom existe é o banco.
 */
export function normalizeCouponCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(code) ? code : null;
}

/** O caminho público do link de um cupom. */
export function couponPath(code: string): string {
  return `/c/${code}`;
}

/** Teto de moedas por cupom. Igual ao CHECK da migração 0055. */
export const COUPON_MAX_COINS = 5000;

/**
 * Teto de resgates por cupom. Igual ao CHECK da migração 0055.
 *
 * **Não existe cupom sem teto**, e é por isso que o campo é obrigatório em vez
 * de admitir "ilimitado": um link público que credita moedas é uma torneira, e
 * o custo de abusá-lo é criar contas Google. Convidar mais gente é emitir outro
 * cupom, que é barato e deixa rastro de por quê.
 */
export const COUPON_MAX_REDEMPTIONS = 1000;

/** O padrão do formulário: um punhado de convidados, não uma campanha. */
export const COUPON_DEFAULT_REDEMPTIONS = 10;

export const CouponCodeSchema = z
  .string()
  .trim()
  .transform((v) => normalizeCouponCode(v))
  .refine((v): v is string => v !== null, "invalid_code");

export const CouponCreateSchema = z.object({
  code: CouponCodeSchema,
  coins: z.number().int().min(1).max(COUPON_MAX_COINS),
  maxRedemptions: z.number().int().min(1).max(COUPON_MAX_REDEMPTIONS),
  label: z.string().trim().max(120).nullable().optional(),
  /** ISO, ou nulo para não expirar. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CouponCreateInput = z.infer<typeof CouponCreateSchema>;

/** Uma linha da tabela do painel: o cupom mais o que já saiu por ele. */
export type AdminCoupon = {
  code: string;
  coins: number;
  label: string | null;
  maxRedemptions: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  /** Quantas contas já nasceram por ele. */
  redemptions: number;
};

/**
 * Por que um cupom não aceita mais ninguém, ou `null` se ele ainda vale.
 *
 * A mesma pergunta é respondida no banco, dentro de `redeem_signup_coupon`, e
 * ter as duas não é duplicar regra: lá ela decide o CRÉDITO, numa transação,
 * com a linha travada; aqui ela decide o RÓTULO que o painel desenha. Um cupom
 * cuja pastilha diz "ativo" quando ele está esgotado é o painel mentindo sobre
 * um link que alguém está prestes a mandar para uma pessoa real.
 */
export function couponUnavailableReason(
  coupon: Pick<AdminCoupon, "isActive" | "expiresAt" | "maxRedemptions" | "redemptions">
): "inactive" | "expired" | "exhausted" | null {
  if (!coupon.isActive) return "inactive";
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return "expired";
  if (coupon.redemptions >= coupon.maxRedemptions) return "exhausted";
  return null;
}
