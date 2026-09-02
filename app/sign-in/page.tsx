import { cookies } from "next/headers";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
import { ReferralField } from "@/features/partners/components/ReferralField";
import { getPartnerPublicBySlug } from "@/lib/db/partners";
import { decodeRef, REF_COOKIE } from "@/lib/partners/cookies";

export const metadata = {
  title: "Entrar ou criar conta · Scriba",
  robots: { index: false, follow: true },
  alternates: { canonical: "/sign-in" },
};

type Search = { next?: string; error?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, error } = await searchParams;
  const referral = await readActiveReferral();
  const target = typeof next === "string" && next.startsWith("/") ? next : "/feed";
  const errorMessage =
    error === "exchange_failed"
      ? "Não consegui completar o login. Tente novamente."
      : error
        ? "Algo deu errado no login. Tente novamente."
        : null;

  return (
    <AuthShell
      title="Entrar no Scriba"
      subtitle="Use sua conta Google para entrar. Se ainda não tem uma conta, ela é criada automaticamente no primeiro acesso — grátis, sem cartão."
      footer={<>Primeira vez por aqui? É só continuar com o Google. Sua conta é criada na hora.</>}
    >
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

/**
 * Resolve a indicação ativa para exibição.
 *
 * O cookie é httpOnly, então esta leitura só pode acontecer no servidor — e é
 * de propósito. Passar o resultado por prop mantém uma fonte de verdade: se a
 * indicação fosse duplicada num cookie legível por JS só para a tela mostrar
 * o nome, os dois valores poderiam divergir e o usuário veria um parceiro
 * diferente do que seria de fato creditado.
 */
async function readActiveReferral(): Promise<{
  partnerName: string;
  bonusCoins: number;
} | null> {
  const jar = await cookies();
  const ref = decodeRef(jar.get(REF_COOKIE)?.value);
  if (!ref) return null;
  const partner = await getPartnerPublicBySlug(ref.slug);
  if (!partner) return null;
  return { partnerName: partner.displayName, bonusCoins: partner.signupBonusCoins };
}
