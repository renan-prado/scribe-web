"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getPartnerPublicBySlug } from "@/lib/db/partners";
import { createLogger } from "@/lib/log";
import {
  encodeRef,
  normalizeSlug,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  refCookieOptions,
} from "@/lib/partners/cookies";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const log = createLogger("partners");

/**
 * Grava um código de indicação digitado na tela de login.
 *
 * Existe porque a atribuição por link falha num caso muito comum e nada
 * exótico: a pessoa vê o vídeo no celular e vai criar a conta no notebook. O
 * cookie ficou no outro aparelho. Sem este campo, a indicação some — e o
 * parceiro reclama, com razão, de ter vendido mais do que o painel mostra.
 *
 * É uma server action, e não um `document.cookie`, porque o cookie é
 * httpOnly: quem escreve é o servidor, que aproveita para conferir se o slug
 * existe antes de aceitar. (Ver o cabeçalho de lib/partners/cookies.ts.)
 */

export type ReferralActionState = {
  status: "idle" | "ok" | "invalid" | "rate_limited";
  /** Nome do parceiro quando `ok` — a tela confirma quem indicou. */
  partnerName?: string;
  bonusCoins?: number;
};

const MIN = 60_000;

export async function applyReferralCode(
  _prev: ReferralActionState,
  formData: FormData
): Promise<ReferralActionState> {
  // Sem sessão para identificar quem chama, então o balde é por IP. Apertado
  // de propósito: este é o único endpoint público que confirma se um código
  // de parceiro existe, e sem limite ele viraria um oráculo para enumerar a
  // lista inteira de slugs por força bruta.
  const ip = getClientIp(await headers());
  const limit = checkRateLimit(`referral-code:ip:${ip}`, 20, 10 * MIN);
  if (!limit.ok) {
    log.warn("referral code rate limited", { ip });
    return { status: "rate_limited" };
  }

  const slug = normalizeSlug(formData.get("code") as string | null);
  if (!slug) return { status: "invalid" };

  const partner = await getPartnerPublicBySlug(slug);
  if (!partner) return { status: "invalid" };

  const jar = await cookies();
  jar.set(REF_COOKIE, encodeRef(partner.slug, "code"), refCookieOptions(REF_COOKIE_MAX_AGE));

  revalidatePath("/sign-in");
  return {
    status: "ok",
    partnerName: partner.displayName,
    bonusCoins: partner.signupBonusCoins,
  };
}

/** Desfaz a indicação — para quem digitou o código errado. */
export async function clearReferralCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(REF_COOKIE);
  revalidatePath("/sign-in");
}
