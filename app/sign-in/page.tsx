import { cookies } from "next/headers";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
import { CouponNotice } from "@/features/coupons/components/CouponNotice";
import { ProspectNotice } from "@/features/partners/components/ProspectNotice";
import { ReferralField } from "@/features/referrals/components/ReferralField";
import { getCouponPublicByCode } from "@/lib/db/coupons";
import { normalizeCouponCode } from "@/lib/domain/coupon";
import { readActiveReferral } from "@/lib/referrals/active";
import { COUPON_COOKIE, PROSPECT_COOKIE } from "@/lib/referrals/cookies";

export const metadata = {
  title: "Entrar ou criar conta · Scriba",
  robots: { index: false, follow: true },
  alternates: { canonical: "/sign-in" },
};

type Search = { next?: string; error?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, error } = await searchParams;
  // A indicação ativa, resolvida no SERVIDOR: o cookie é httpOnly, então esta
  // leitura só pode acontecer aqui, e é de propósito. Duplicá-la num cookie
  // legível por JS só para a tela mostrar o nome criaria dois valores para a
  // mesma coisa, e o dia em que eles divergissem a tela anunciaria um padrinho
  // diferente do que seria de fato creditado.
  //
  // Ao contrário do hero da landing page, aqui não há salto nem requisição
  // extra: esta página já é dinâmica (ela lê cookie de qualquer forma), então o
  // rosto de quem indicou vem no HTML.
  const referral = await readActiveReferral();
  // "Esta visita veio de /parceiros." Lido aqui pelo mesmo motivo do cookie de
  // indicação: ele é httpOnly, e duplicá-lo num cookie legível só para a tela
  // se personalizar criaria dois valores para a mesma coisa. O selo só aparece
  // quando NÃO há indicação ativa, quem veio pelo link de um parceiro já tem
  // um brinde a caminho, e `attach_partner_prospect` recusa o segundo; anunciar
  // os dois seria prometer moeda que não vai ser creditada.
  const jar = await cookies();
  const isProspect = !referral && jar.get(PROSPECT_COOKIE)?.value === "1";
  // O cupom é resolvido no servidor pelo mesmo motivo que a indicação: o cookie
  // é httpOnly e carrega só o CÓDIGO, nunca o valor. Quem diz quanto ele vale é
  // o banco, e só enquanto o cupom ainda for resgatável (ativo, não expirado,
  // não esgotado): são as três recusas de `redeem_signup_coupon`, e anunciar um
  // bônus que ela vai negar é prometer moeda que não será creditada.
  //
  // Ao contrário do pré-parceiro, o selo do cupom aparece MESMO havendo
  // indicação ativa, porque os dois são de fato creditados (ver a migração
  // 0055): esconder um deles faria a tela prometer menos do que vai entregar.
  const couponCode = normalizeCouponCode(jar.get(COUPON_COOKIE)?.value);
  const coupon = couponCode ? await getCouponPublicByCode(couponCode) : null;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/feed";
  const errorMessage =
    error === "exchange_failed"
      ? "Não consegui completar o login. Tente novamente."
      : error
        ? "Algo deu errado no login. Tente novamente."
        : null;

  return (
    <AuthShell
      title={
        coupon
          ? "Seu convite está aqui"
          : isProspect
            ? "Conheça o Scriba por dentro"
            : "Entrar no Scriba"
      }
      subtitle={
        coupon
          ? "Crie sua conta com o Google e as moedas do convite entram no seu saldo na hora."
          : isProspect
            ? "Crie sua conta com o Google e receba moedas para usar o app antes de decidir qualquer coisa."
            : "Use sua conta Google para entrar. Se ainda não tem uma conta, ela é criada automaticamente no primeiro acesso, grátis, sem cartão."
      }
      footer={<>Primeira vez por aqui? É só continuar com o Google. Sua conta é criada na hora.</>}
    >
      {coupon ? <CouponNotice coins={coupon.coins} /> : null}
      {isProspect ? <ProspectNotice /> : null}
      <GoogleSignInButton next={target} label="Continuar com Google" />
      <ReferralField active={referral} />
      {errorMessage ? (
        <div
          className="flex items-start gap-2 rounded-2xl bg-scriba-rose px-4 py-3 text-[12.5px] leading-[1.5] text-scriba-rose-ink"
          role="alert"
        >
          <span
            aria-hidden
            className="mt-1 inline-block size-1.5 flex-none rounded-full bg-scriba-rose-accent"
          />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <p className="text-center text-[11.5px] font-light text-scriba-ink-mute">
        Ao continuar, você aceita nossos termos e a política de privacidade.
      </p>
    </AuthShell>
  );
}
