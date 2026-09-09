import "server-only";
import { cookies } from "next/headers";
import { getPartnerPublicBySlug } from "@/lib/db/partners";
import { getReferrerPublicByCode } from "@/lib/db/referrals";
import { decodeRef, REF_COOKIE } from "@/lib/referrals/cookies";

/**
 * "Quem está indicando esta visita?" — resolvido no SERVIDOR, a partir do
 * cookie `httpOnly`, para as duas telas que mostram o selo: a de entrada
 * (server component, sem piscar) e o hero da landing page (via
 * `/api/referral/active`, porque a LP é estática).
 *
 * Um resolvedor só para as duas porque a resposta tem de ser a MESMA. Se cada
 * tela montasse a sua, um dia elas divergiriam — e divergir aqui significa
 * anunciar um padrinho diferente do que será de fato creditado, que é o pior
 * jeito de essa funcionalidade falhar.
 *
 * Nada aqui é gated por sessão: quem lê é um visitante anônimo, por definição.
 * O que sai é só o que `ReferrerPublic`/`PartnerPublic` autorizam — nome de
 * exibição, foto, e as moedas que o CONVIDADO ganha. Nunca id, nunca e-mail.
 */

export type ActiveReferral = {
  program: "partner" | "friend";
  /**
   * Como chamar quem indicou.
   *
   * Nome COMPLETO no programa de parceiros e PRIMEIRO NOME no de amigos, e a
   * diferença não é descuido: o `display_name` do parceiro é o nome artístico
   * que o admin cadastrou, é público por profissão e é assim que a audiência o
   * reconhece. Já quem manda o link no grupo da igreja não escolheu virar
   * marca — para essa pessoa, o primeiro nome basta para o convite fazer
   * sentido e é tudo o que um estranho precisa saber.
   */
  name: string;
  avatarUrl: string | null;
  /**
   * Moedas que QUEM CHEGA ganha ao criar a conta, além das 50 de boas-vindas.
   *
   * Sempre 0 no programa de amigos: lá quem ganha é quem indica. É por isso
   * que o link do parceiro continua sendo a melhor oferta da casa, e a tela
   * simplesmente não fala em bônus quando este número é zero.
   */
  bonusCoins: number;
};

export async function readActiveReferral(): Promise<ActiveReferral | null> {
  const jar = await cookies();
  const ref = decodeRef(jar.get(REF_COOKIE)?.value);
  if (!ref) return null;

  if (ref.program === "friend") {
    const referrer = await getReferrerPublicByCode(ref.code);
    if (!referrer) return null;
    return {
      program: "friend",
      name: referrer.firstName,
      avatarUrl: referrer.avatarUrl,
      bonusCoins: 0,
    };
  }

  const partner = await getPartnerPublicBySlug(ref.slug);
  if (!partner) return null;
  return {
    program: "partner",
    name: partner.displayName,
    avatarUrl: partner.avatarUrl,
    bonusCoins: partner.signupBonusCoins,
  };
}
