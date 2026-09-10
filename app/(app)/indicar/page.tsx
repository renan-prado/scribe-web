import { ArrowLeft, Gift, TriangleAlert, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoinMark } from "@/components/icons/CoinMark";
import { NavLink } from "@/components/NavLink";
import { InviteLinkCard } from "@/features/referrals/components/InviteLinkCard";
import { appUrl } from "@/lib/billing/stripe";
import { getCurrentProfile } from "@/lib/db/profiles";
import { ensureReferralCode, loadReferralPanel } from "@/lib/db/referrals";
import {
  REFERRAL_MONTHLY_SIGNUP_CAP,
  REFERRAL_SIGNUP_COINS,
  REFERRAL_SUBSCRIPTION_COINS,
  referralPath,
} from "@/lib/referrals/economics";

export const metadata: Metadata = { title: "Indique a um amigo" };
export const dynamic = "force-dynamic";

const INT = new Intl.NumberFormat("pt-BR");

/**
 * A página do "Indique a um amigo".
 *
 * Página própria, e não um cartão no `/profile`, porque aqui há uma OFERTA a
 * explicar. O convidado não ganha moedas neste programa, quem ganha é quem
 * indica, então o texto que faz alguém compartilhar é o único argumento que
 * sobra. Espremido entre o saldo e os dados da conta, ele não caberia.
 *
 * SÓ AGREGADOS, como no painel do parceiro: "3 amigos entraram", nunca "estes
 * 3". Ver `lib/db/referrals.ts`.
 *
 * O código é gerado na PRIMEIRA visita (`ensureReferralCode`), não no cadastro
 * de toda conta, a maioria das pessoas nunca vai abrir esta página.
 *
 * **O botão de voltar segue de ONDE a pessoa veio**, e por isso existe o
 * `?de=feed`. Esta página tem duas portas, o cartão do `/profile` e o card do
 * `/feed`, e um destino fixo mandaria metade das visitas para uma tela em
 * que elas não estavam. O parâmetro só ENDEREÇA, como o `?plan=` do checkout:
 * ele é conferido contra uma lista FECHADA de dois destinos, então nada que
 * alguém digite na URL vira um caminho novo. Valor desconhecido, ausente ou
 * forjado cai no perfil, que é onde esta página mora na navegação.
 *
 * `router.back()` foi descartado: quem abre o link direto (compartilhado,
 * PWA aberto do zero) não tem histórico dentro do app, e o botão o jogaria
 * para fora do Scriba. Um link de verdade também funciona sem JavaScript e
 * pode ser aberto em outra aba.
 */

/** Os únicos destinos que o `?de=` alcança. */
const ORIGENS = {
  feed: { href: "/feed", label: "Voltar ao feed" },
  perfil: { href: "/profile", label: "Voltar ao perfil" },
} as const;

type Search = { de?: string };

export default async function IndicarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { de } = await searchParams;
  const origem = de === "feed" ? ORIGENS.feed : ORIGENS.perfil;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");

  const [code, panel] = await Promise.all([
    ensureReferralCode(profile.id),
    loadReferralPanel(profile.id),
  ]);

  const remaining = Math.max(0, REFERRAL_MONTHLY_SIGNUP_CAP - panel.signupsThisMonth);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      {/* Mesmo idioma dos outros "voltar" do app (a página de estudo e a
          sessão salva): `NavLink` com a seta, acima do cabeçalho, e o destino
          escrito no rótulo, ninguém clica sem saber onde vai parar. */}
      <NavLink
        href={origem.href}
        className="-mx-1 inline-flex w-fit items-center rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="size-3.5" />
        {origem.label}
      </NavLink>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-scriba-ink-strong sm:text-3xl">
          Indique a um amigo
        </h1>
        <p className="text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft">
          Alguém da sua igreja ainda anota sermão no papel? Mande o Scriba para essa pessoa. Cada
          amigo que entra pelo seu link vira moeda na sua conta, e mais moedas ainda se ele assinar.
        </p>
      </header>

      {code ? (
        <InviteLinkCard
          link={appUrl(referralPath(code))}
          code={code}
          signupCoins={REFERRAL_SIGNUP_COINS}
          subscriptionCoins={REFERRAL_SUBSCRIPTION_COINS}
        />
      ) : (
        // Sem código não há link, e um link errado é PIOR que nenhum: ele
        // atribuiria a indicação a outra pessoa. Ver `ensureReferralCode`.
        <section
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-scriba-rose px-4 py-3.5 text-scriba-rose-ink"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
          <p className="text-[12.5px] leading-[1.5]">
            Não consegui gerar seu link de indicação agora. Recarregue a página em alguns instantes.
          </p>
        </section>
      )}

      <section className="grid grid-cols-3 gap-3">
        <Stat
          icon={<UserPlus aria-hidden className="size-4" />}
          label="Entraram"
          value={INT.format(panel.signups)}
        />
        <Stat
          icon={<Gift aria-hidden className="size-4" />}
          label="Assinaram"
          value={INT.format(panel.subscribers)}
        />
        <Stat icon={<CoinMark size={16} />} label="Moedas" value={INT.format(panel.coinsEarned)} />
      </section>

      <section className="flex flex-col gap-2.5 rounded-2xl bg-scriba-paper p-5 ring-1 ring-scriba-hairline">
        <h2 className="text-[13px] font-semibold text-scriba-ink-strong">Como funciona</h2>
        <ul className="flex flex-col gap-2 text-[12.5px] font-light leading-[1.5] text-scriba-ink-soft">
          <li>
            As moedas do cadastro caem assim que seu amigo cria a conta pelo seu link, não precisa
            esperar nada.
          </li>
          <li>
            As moedas da assinatura vêm uma única vez por pessoa, quando ela paga a primeira
            mensalidade.
          </li>
          <li>
            Só contam contas NOVAS. Quem já usa o Scriba não vira indicação ao abrir seu link.
          </li>
          <li>
            {/* O teto é o sinal que separa "indiquei meus amigos" de "estou
                divulgando", e a segunda coisa tem um programa próprio, com
                comissão em dinheiro. Dizê-lo aqui evita a descoberta pelo
                silêncio: um mês em que as moedas simplesmente param de vir. */}
            São até {REFERRAL_MONTHLY_SIGNUP_CAP} cadastros premiados por mês
            {remaining < REFERRAL_MONTHLY_SIGNUP_CAP ? (
              <>
                {", "}
                <strong className="font-medium text-scriba-ink-strong">
                  {remaining === 0
                    ? "você já chegou ao limite deste mês"
                    : `faltam ${remaining} neste mês`}
                </strong>
              </>
            ) : null}
            . Passou disso, o cadastro continua valendo e a moeda da assinatura também; só o bônus
            de entrada pausa até o mês seguinte. Se você indica muita gente, fale com a gente sobre
            o programa de parceiros.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-scriba-paper p-4 ring-1 ring-scriba-hairline">
      <span className="flex items-center gap-1.5 text-scriba-ink-mute">{icon}</span>
      <span className="text-[20px] font-semibold leading-none text-scriba-ink-strong">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-scriba-ink-mute">
        {label}
      </span>
    </div>
  );
}
