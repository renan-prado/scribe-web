import "server-only";
import { cookies } from "next/headers";
import {
  COUPON_COOKIE,
  decodeRef,
  PROSPECT_COOKIE,
  REF_COOKIE,
  REF_HINT_COOKIE,
  VISIT_COOKIE,
} from "@/features/referrals/cookies";
import { redeemSignupCoupon } from "@/lib/db/coupons";
import { attachPartner } from "@/lib/db/partners";
import { attachPartnerProspect } from "@/lib/db/prospects";
import { attachReferrer } from "@/lib/db/referrals";
import { normalizeCouponCode } from "@/lib/domain/coupon";
import { createLogger } from "@/lib/log";

const log = createLogger("auth/welcome");

/**
 * Tudo o que uma conta RECÉM-NASCIDA tem a receber: a atribuição de quem a
 * indicou, o selo de pré-parceiro e o cupom de convite.
 *
 * **Isto morava dentro de `/auth/callback`, e saiu de lá no dia em que o login
 * por e-mail e senha entrou.** O callback deixou de ser o único caminho por
 * onde uma conta nasce: com a confirmação de e-mail DESLIGADA no Supabase, o
 * `signUp` devolve sessão na hora e ninguém passa por lá; com ela ligada, quem
 * confirma pode cair no `/auth/confirm` (link com `token_hash`) em vez do
 * `/auth/callback` (link com `code`). Três portas, um brinde: deixá-lo na
 * primeira faria o cupom de alguém sumir sem erro em lugar nenhum, que é o
 * pior jeito de uma promessa falhar.
 *
 * **Chamar duas vezes é seguro**, e isso não é descuido, é requisito: as três
 * RPCs recusam sozinhas a segunda tentativa (`already_attributed`, `not_new`),
 * então uma pessoa que confirme o e-mail e depois faça login pelo Google no
 * mesmo navegador não ganha nada duas vezes.
 *
 * A ORDEM é a regra, não acaso: a indicação vem primeiro porque ela decide
 * DINHEIRO (a comissão de quem indicou) e o brinde de 150 moedas. O
 * pré-parceiro roda depois e se recusa sozinho quando encontra uma atribuição
 * já gravada, é assim que os dois brindes de boas-vindas não se empilham sem
 * que ninguém tenha decidido isso. Ver a migração 0050.
 *
 * O cupom é o terceiro e NÃO participa dessa recusa: ele é um convite que o
 * admin emitiu para uma pessoa escolhida, com teto próprio, e negá-lo em
 * silêncio porque a pessoa clicou num link de parceiro semana passada faria o
 * convite falhar exatamente onde ele foi mais intencional. Ver a migração 0055.
 */
export async function applyWelcomeBonuses(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  await attachReferralIfAny(userId);
  await attachProspectIfAny(userId);
  await redeemCouponIfAny(userId);
}

/**
 * Vincula a conta a quem a indicou, se houver indicação ativa, e credita o que
 * cada programa manda creditar. Roda no primeiro login de quem chegou por
 * `/r/<slug>`, por `/i/<codigo>` ou digitou um código na tela de entrada.
 *
 * É aqui, e não no trigger de criação do perfil, porque o cookie só existe no
 * contexto da requisição, o trigger do banco roda dentro do Supabase Auth e
 * não enxerga o navegador.
 *
 * **UM cookie, portanto UMA atribuição.** Os dois programas gravam no mesmo
 * `scriba_ref`, então quem clicou no link de um parceiro e depois no de um
 * amigo tem um padrinho só: o último. A exclusividade é reforçada no banco,
 * `attach_partner` e `attach_referrer` conferem a coluna um do outro antes de
 * gravar a sua.
 *
 * NADA aqui pode impedir o login. Toda recusa (`already_attributed`,
 * `not_new`, `unknown_slug`/`unknown_code`, `self_referral`, `capped`) é
 * normal e vira log; uma exceção inesperada é engolida pelo try/catch. A
 * pessoa está no meio da entrada no app, e perder um bônus é ruim, não entrar
 * é pior.
 *
 * Os cookies são apagados em qualquer desfecho. Eles já cumpriram o papel: a
 * atribuição agora vive em `profiles`, e é permanente. Deixá-los por mais 30
 * dias faria toda visita seguinte a `/auth/callback` (um novo login em outro
 * aparelho, por exemplo) tentar de novo uma atribuição já resolvida.
 */
async function attachReferralIfAny(userId: string): Promise<void> {
  try {
    const jar = await cookies();
    const ref = decodeRef(jar.get(REF_COOKIE)?.value);
    if (!ref) return;

    if (ref.program === "friend") {
      const result = await attachReferrer({ userId, code: ref.code, source: ref.source });
      log.info("atribuição de indicação", { ...ref, result });
    } else {
      const result = await attachPartner({ userId, slug: ref.slug, source: ref.source });
      log.info("atribuição de parceiro", { ...ref, result });
    }

    jar.delete(REF_COOKIE);
    jar.delete(VISIT_COOKIE);
    jar.delete(REF_HINT_COOKIE);
  } catch (err) {
    log.error("attach de indicação falhou", { error: (err as Error).message });
  }
}

/**
 * Resgata o cupom de cadastro, se a visita trouxe um.
 *
 * Toda a regra está na RPC `redeem_signup_coupon` (janela de conta nova, cupom
 * inativo, expirado ou esgotado, uma vez por pessoa, e o crédito por
 * `grant_coins`). Aqui, como nos dois irmãos acima, NADA pode impedir o login:
 * todo desfecho vira log e uma exceção inesperada é engolida. Perder um brinde
 * é ruim; não conseguir entrar é pior.
 *
 * O cookie é apagado em QUALQUER desfecho, inclusive nos "não". Um `exhausted`
 * ou um `expired` não muda com o tempo, e deixar o cookie vivo faria todo login
 * futuro em outro aparelho tentar de novo o que já foi decidido.
 */
async function redeemCouponIfAny(userId: string): Promise<void> {
  try {
    const jar = await cookies();
    // Normaliza de novo aqui: o valor veio de um cookie, e cookie é entrada do
    // cliente. Um código impossível nem chega a custar uma ida ao banco.
    const code = normalizeCouponCode(jar.get(COUPON_COOKIE)?.value);
    if (!code) return;

    const result = await redeemSignupCoupon(userId, code);
    log.info("cupom de cadastro", { code, result });

    jar.delete(COUPON_COOKIE);
  } catch (err) {
    log.error("resgate de cupom falhou", { error: (err as Error).message });
  }
}

/**
 * Registra quem chegou por `/parceiros` como PRÉ-PARCEIRO e credita a cortesia.
 *
 * Sem compromisso nenhum dos dois lados: a pessoa não prometeu divulgar, e nós
 * não prometemos aceitá-la no programa. O que a linha em `partner_prospects`
 * guarda é "esta pessoa se interessou", a promoção a parceiro de verdade é um
 * cadastro manual no admin, depois, se as duas partes quiserem.
 *
 * Toda a regra está na RPC (janela de conta nova, recusa de bônus empilhado,
 * teto global). Aqui, como no irmão acima, NADA pode impedir o login: todo
 * desfecho vira log, e uma exceção inesperada é engolida. Perder um brinde é
 * ruim; não conseguir entrar é pior.
 *
 * O cookie é apagado em qualquer desfecho, inclusive nos "não". Um `capped` ou
 * `already_attributed` não muda com o tempo, e deixar o cookie vivo faria todo
 * login futuro em outro aparelho tentar de novo o que já foi decidido.
 */
async function attachProspectIfAny(userId: string): Promise<void> {
  try {
    const jar = await cookies();
    if (jar.get(PROSPECT_COOKIE)?.value !== "1") return;

    const result = await attachPartnerProspect(userId);
    log.info("pré-parceiro", { result });

    jar.delete(PROSPECT_COOKIE);
  } catch (err) {
    log.error("attach de pré-parceiro falhou", { error: (err as Error).message });
  }
}
