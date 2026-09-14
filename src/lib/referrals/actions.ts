"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getPartnerPublicBySlug } from "@/lib/db/partners";
import { getReferrerPublicByCode } from "@/lib/db/referrals";
import { createLogger } from "@/lib/log";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  encodeRef,
  normalizeSlug,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  REF_HINT_COOKIE,
  refCookieOptions,
  refHintCookieOptions,
} from "@/lib/referrals/cookies";
import { normalizeReferralCode } from "@/lib/referrals/economics";

const log = createLogger("referrals");

/**
 * Grava um código de indicação digitado na tela de login, de PARCEIRO ou de
 * amigo, o mesmo campo para os dois.
 *
 * Existe porque a atribuição por link falha num caso muito comum e nada
 * exótico: a pessoa vê o vídeo no celular e vai criar a conta no notebook. O
 * cookie ficou no outro aparelho. Sem este campo, a indicação some, e o
 * parceiro reclama, com razão, de ter vendido mais do que o painel mostra.
 *
 * É uma server action, e não um `document.cookie`, porque o cookie é
 * httpOnly: quem escreve é o servidor, que aproveita para conferir se o código
 * existe antes de aceitar. (Ver o cabeçalho de lib/referrals/cookies.ts.)
 *
 * **A ordem de resolução é parceiro primeiro, amigo depois**, e ela importa
 * num caso de borda real: um código de amigo tem 7 caracteres minúsculos
 * alfanuméricos, e um slug de parceiro ADMITE essa forma. Se as duas coisas
 * coincidirem, ganha o parceiro, é a relação comercial, com comissão em
 * dinheiro e um acordo assinado atrás dela, e é a única das duas cujo
 * identificador alguém escolheu à mão (o admin, que pode evitar a colisão).
 */

export type ReferralActionState = {
  status: "idle" | "ok" | "invalid" | "rate_limited";
  program?: "partner" | "friend";
  /** Nome de quem indicou, a tela confirma para quem o crédito vai. */
  name?: string;
  avatarUrl?: string | null;
  /** Moedas que QUEM CHEGA ganha. 0 no programa de amigos. */
  bonusCoins?: number;
};

const MIN = 60_000;

export async function applyReferralCode(
  _prev: ReferralActionState,
  formData: FormData
): Promise<ReferralActionState> {
  // Sem sessão para identificar quem chama, então o balde é por IP. Apertado
  // de propósito: este é o único endpoint público que confirma se um código
  // existe, e sem limite ele viraria um oráculo para enumerar por força bruta
  // a lista de slugs de parceiro, e, agora, o espaço de códigos de usuário.
  const ip = getClientIp(await headers());
  const limit = checkRateLimit(`referral-code:ip:${ip}`, 20, 10 * MIN);
  if (!limit.ok) {
    log.warn("referral code rate limited", { ip });
    return { status: "rate_limited" };
  }

  const raw = formData.get("code") as string | null;

  const slug = normalizeSlug(raw);
  if (slug) {
    const partner = await getPartnerPublicBySlug(slug);
    if (partner) {
      await writeRef(partner.slug, "partner");
      return {
        status: "ok",
        program: "partner",
        name: partner.displayName,
        avatarUrl: partner.avatarUrl,
        bonusCoins: partner.signupBonusCoins,
      };
    }
  }

  const code = normalizeReferralCode(raw);
  if (code) {
    const referrer = await getReferrerPublicByCode(code);
    if (referrer) {
      await writeRef(code, "friend");
      return {
        status: "ok",
        program: "friend",
        name: referrer.firstName,
        avatarUrl: referrer.avatarUrl,
        bonusCoins: 0,
      };
    }
  }

  return { status: "invalid" };
}

/**
 * Grava o par de cookies da indicação: o de atribuição (httpOnly, que decide
 * dinheiro) e a pista (legível, que só diz que EXISTE indicação, para o hero
 * da landing page não perguntar ao servidor à toa).
 */
async function writeRef(id: string, program: "partner" | "friend"): Promise<void> {
  const jar = await cookies();
  jar.set(REF_COOKIE, encodeRef(id, "code", program), refCookieOptions(REF_COOKIE_MAX_AGE));
  jar.set(REF_HINT_COOKIE, "1", refHintCookieOptions(REF_COOKIE_MAX_AGE));
  revalidatePath("/sign-in");
}

/** Desfaz a indicação, para quem digitou o código errado. */
export async function clearReferralCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(REF_COOKIE);
  jar.delete(REF_HINT_COOKIE);
  revalidatePath("/sign-in");
}
