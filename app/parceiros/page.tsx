import type { Metadata } from "next";
import Link from "next/link";
import { formatBrl, formatCoins, PLANS } from "@/lib/billing/plans";
import { COIN_COSTS, INITIAL_COIN_BALANCE } from "@/lib/coins/pricing";
import {
  COMMISSION_HOLD_DAYS,
  commissionCents,
  DEFAULT_COMMISSION_BPS,
  DEFAULT_PARTNER_MONTHLY_COINS,
  DEFAULT_PARTNER_SIGNUP_REWARD_COINS,
  DEFAULT_SIGNUP_BONUS_COINS,
  PARTNER_PROSPECT_COINS,
  PAYOUT_MINIMUM_CENTS,
} from "@/lib/partners/economics";
import { REF_COOKIE_MAX_AGE } from "@/lib/referrals/cookies";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { CoinMark } from "@/shared/icons/CoinMark";

export const metadata: Metadata = {
  title: "Programa de Parceiros · Scriba",
  description:
    "Divulgue o Scriba para quem já te acompanha e receba 30% da primeira mensalidade de cada assinante. Link próprio, painel de resultados e moedas para usar o app.",
  alternates: { canonical: "/parceiros" },
};

/**
 * A página de convite do Programa de Parceiros.
 *
 * É a LP da landing page vista de outro lado: mesma linguagem visual, mesmo
 * chrome, outra pergunta. A `/` responde "por que eu usaria isso?"; esta
 * responde "por que eu FALARIA disso?", e a segunda só se responde depois da
 * primeira, por isso a página explica o produto antes de falar em dinheiro.
 *
 * **Estática, pelas mesmas razões da `/`** (ver `app/AGENTS.md` § Landing
 * page): nada aqui lê cookie, sessão ou header, e nenhum componente
 * `"use client"` é importado. Ela é servida da CDN para um visitante que, por
 * definição, ainda não tem conta.
 *
 * **E ela não tem números próprios.** Percentual, carência, mínimo de saque,
 * moedas e preços saem de `lib/partners/economics.ts`, `lib/billing/plans.ts`
 * e `lib/coins/pricing.ts`, os mesmos módulos que o painel do parceiro e o
 * simulador do admin leem. Um número redigitado aqui vira, semanas depois,
 * uma promessa que o painel desmente para a pessoa que confiou nela. A regra
 * inclui os MINUTOS: "500 moedas dão ~100 min" era verdade quando o minuto ao
 * vivo custava 5, e virou mentira em silêncio quando passou a custar 7.
 *
 * O regulamento detalhado é `/parceiros/regulamento`, e ele é a versão que
 * vale: esta página resume, aquela obriga.
 */

/**
 * O CTA não vai direto para `/sign-in`: passa por `/parceiros/entrar`, que
 * marca o visitante como pré-parceiro num cookie e só então redireciona. É o
 * mesmo desenho de `/r/<slug>`, e pela mesma razão, esta página é estática e
 * não pode escrever cookie sem deixar de ser. Sem esse desvio, a tela de
 * entrada não teria como saber que a pessoa veio daqui, e as moedas de
 * cortesia nunca seriam creditadas.
 */
const PROSPECT_ENTRY = "/parceiros/entrar";

/** Janela de atribuição do link, em dias. Vem do cookie, não de um literal. */
const ATTRIBUTION_DAYS = REF_COOKIE_MAX_AGE / (24 * 60 * 60);

/** Total creditado a quem se cadastra pelo link: boas-vindas + bônus. */
const REFERRED_TOTAL_COINS = INITIAL_COIN_BALANCE + DEFAULT_SIGNUP_BONUS_COINS;

/** Minutos de gravação que uma quantidade de moedas paga, no modo indicado. */
function minutesFor(coins: number, costPerMinute: number): number {
  return Math.floor(coins / costPerMinute);
}

const COMMISSION_PCT = DEFAULT_COMMISSION_BPS / 100;

export default function PartnersLandingPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingHeader />
      <main>
        <Hero />
        <TryFirst />
        <WhatIsScriba />
        <WhatToShow />
        <HowYouEarn />
        <Panel />
        <Rules />
        <HowToJoin />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="relative mt-[calc(var(--lp-header-h)*-1)] overflow-hidden bg-[image:var(--lp-hero)]">
      <div className="pointer-events-none absolute -top-[180px] -right-[140px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-[120px] -left-[160px] hidden h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)] lg:block" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pb-12 pt-[calc(var(--lp-header-h)+2.25rem)] sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pb-24 lg:pt-[calc(var(--lp-header-h)+5rem)]">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <div className="w-fit rounded-full border border-scriba-hairline bg-scriba-paper px-3.5 py-1.5 text-[11.5px] font-medium text-scriba-ink-soft">
            Programa de Parceiros · <span className="text-scriba-ink">por convite</span>
          </div>
          <h1 className="text-pretty text-[36px] font-semibold leading-[1.08] tracking-[-.025em] text-scriba-ink-strong lg:text-[56px] lg:leading-[1.06]">
            Seja um parceiro do Scriba!
          </h1>
          <p className="max-w-[540px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[17.5px]">
            Você já fala com quem ouve pregação toda semana. Se o Scriba for útil para eles, indique
            o app que transcreve o sermão e entrega o resumo pronto quando o culto acaba e receba{" "}
            <span className="font-medium text-scriba-ink">
              {COMMISSION_PCT.toLocaleString("pt-BR")}% da primeira mensalidade
            </span>{" "}
            de cada pessoa que assinar pelo seu link.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href={PROSPECT_ENTRY}
              className="scriba-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-[image:var(--scriba-cta)] py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink shadow-[0_9px_22px_var(--scriba-cta-shadow)]"
            >
              <ScribaMark size={20} />
              Conhecer sem compromisso
            </Link>
            <Link
              href="/parceiros/regulamento"
              className="lp-cta-outline inline-flex items-center justify-center rounded-[26px] border border-auth-btn-border bg-scriba-paper py-4 px-7 text-[13px] font-medium text-scriba-ink"
            >
              Ler as regras completas
            </Link>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1.5 text-[12.5px] font-light text-scriba-ink-mute sm:pt-3">
            {["Sem compromisso", "Sem exclusividade", "Sem meta mínima"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="text-scriba-green" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <InviteCard />
      </div>
    </section>
  );
}

/**
 * O cartão do convite. Ele existe para responder, sem rolagem, a pergunta que
 * traz alguém a esta página: "o que eu ganho com isso?", e responde nas duas
 * moedas do programa, o dinheiro e as moedas do app, porque só uma das duas
 * chega rápido.
 */
function InviteCard() {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[26px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_16px_40px_rgba(0,0,0,.12)] sm:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-scriba-ink-mute">
        O que o programa inclui
      </div>
      <ul className="flex flex-col divide-y divide-scriba-hairline">
        <InviteRow
          title={`${COMMISSION_PCT.toLocaleString("pt-BR")}% da primeira mensalidade`}
          body={`${formatBrl(commissionCents(PLANS.pessoal.priceCents, DEFAULT_COMMISSION_BPS))} no ${PLANS.pessoal.name}, ${formatBrl(commissionCents(PLANS.estudioso.priceCents, DEFAULT_COMMISSION_BPS))} no ${PLANS.estudioso.name}. Pago por PIX.`}
        />
        <InviteRow
          title={`${formatCoins(DEFAULT_PARTNER_SIGNUP_REWARD_COINS)} moedas por cadastro`}
          body="A cada pessoa que cria conta pelo seu link, mesmo que ela nunca assine."
          coin
        />
        <InviteRow
          title={`${formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês, para você usar`}
          body="Renovadas todo mês, a partir do momento em que você entra no programa. Não dependem de indicar ninguém."
          coin
        />
        <InviteRow
          title="Um painel só seu"
          body="Quantas pessoas abriram seu link, quantas criaram conta, quantas assinaram e quanto você tem a receber."
        />
      </ul>
      <p className="border-t border-scriba-hairline pt-4 text-[12px] font-light leading-[1.55] text-scriba-ink-mute">
        Nada disso começa hoje: primeiro você cria a conta e usa o app por nossa conta. Entrar no
        programa é um segundo passo, e só se as duas partes quiserem.
      </p>
    </div>
  );
}

function InviteRow({ title, body, coin }: { title: string; body: string; coin?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      {coin ? (
        <CoinMark size={20} className="mt-0.5 flex-none" />
      ) : (
        <span
          aria-hidden
          className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-scriba-blue-soft"
        >
          <Check className="text-scriba-blue-ink" />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold leading-[1.35] text-scriba-ink-strong">
          {title}
        </span>
        <span className="text-pretty text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft">
          {body}
        </span>
      </div>
    </li>
  );
}

/* ---------- Conheça antes de decidir ---------- */

/**
 * As moedas de cortesia, e a razão de elas virem ANTES do dinheiro na página.
 *
 * Ninguém recomenda de verdade um app que não usa, e pedir que alguém divulgue
 * primeiro e experimente depois inverte a ordem em que a confiança se forma.
 * A mesada existe no código por essa razão (`lib/partners/allowance.ts`), e a
 * página coloca a mesma razão na frente do percentual.
 */
function TryFirst() {
  const liveMinutes = minutesFor(PARTNER_PROSPECT_COINS, COIN_COSTS.liveMinute);
  const audioMinutes = minutesFor(PARTNER_PROSPECT_COINS, COIN_COSTS.audioOnlyMinute);
  return (
    <section id="conhecer" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <SectionLabel color="blue">Conheça primeiro</SectionLabel>
          <h2 className="text-pretty text-[27px] font-semibold leading-[1.18] tracking-[-.02em] text-scriba-ink-strong lg:text-[38px]">
            Primeiro você conhece. Depois, se quiser, a gente conversa.
          </h2>
          <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[16px]">
            Ninguém consegue falar bem de um app que nunca abriu. Por isso o primeiro passo não é
            assinar nada: crie sua conta pela página de parceiros e{" "}
            {formatCoins(PARTNER_PROSPECT_COINS)} moedas entram no seu saldo para você usar o Scriba
            de verdade. <strong className="font-medium">Sem compromisso nenhum</strong>: você não
            está entrando no programa, está conhecendo o produto.
          </p>
          <p className="max-w-[520px] text-pretty text-[13.5px] font-light leading-[1.62] text-scriba-ink-mute lg:text-[14.5px]">
            Se você concluir que o Scriba não combina com o seu público, é só não voltar, não há
            nada a cancelar e ninguém sai no prejuízo. Se concluir que combina, aí sim a gente
            conversa sobre link, comissão e painel.
          </p>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-[26px] border border-scriba-hairline bg-scriba-cream p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <CoinMark size={30} className="flex-none" />
              <div className="flex flex-col">
                <span className="text-[30px] font-semibold leading-none tracking-[-.02em] text-scriba-cream-ink sm:text-[34px]">
                  {formatCoins(PARTNER_PROSPECT_COINS)}
                </span>
                <span className="text-[12px] font-medium text-scriba-cream-accent">
                  moedas ao criar sua conta
                </span>
              </div>
            </div>
            <p className="text-pretty text-[13px] font-light leading-[1.6] text-scriba-cream-body">
              São cerca de <strong className="font-semibold">{liveMinutes} minutos</strong> de
              gravação no Modo Completo, com feed ao vivo e resumo final, ou {audioMinutes} minutos
              no Modo Áudio. Dá para o culto de domingo e o estudo do meio da semana.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniCard
              title="Receba agora, não depois"
              body={`As ${formatCoins(PARTNER_PROSPECT_COINS)} moedas entram no saldo assim que a conta é criada pela página de parceiros.`}
            />
            <MiniCard
              title="E se você entrar no programa"
              body={`Passa a receber ${formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês, renovadas, além destas.`}
            />
          </div>
          <p className="text-[12px] font-light leading-[1.55] text-scriba-ink-mute">
            E antes mesmo de entrar no programa: toda conta nova ganha{" "}
            {formatCoins(INITIAL_COIN_BALANCE)} moedas. Dá para importar um culto do YouTube e ler o
            resumo hoje, sem esperar o domingo.
          </p>
        </div>
      </div>
    </section>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] border border-scriba-hairline bg-scriba-paper p-5">
      <span className="text-[13px] font-semibold text-scriba-ink-strong">{title}</span>
      <span className="text-pretty text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft">
        {body}
      </span>
    </div>
  );
}

/* ---------- O que é o Scriba ---------- */

const DEFINITIONS: { term: string; detail: string }[] = [
  {
    term: "O que é",
    detail:
      "Um aplicativo web que acompanha a pregação pelo microfone, transcreve o que é dito, reconhece as passagens bíblicas citadas e entrega um resumo estruturado quando a mensagem termina.",
  },
  {
    term: "Para quem é",
    detail:
      "Membros que querem lembrar do domingo durante a semana, líderes de célula preparando a reunião, estudantes de teologia e quem acompanha pregações e quer revisá-las depois.",
  },
  {
    term: "Onde funciona",
    detail:
      "No navegador do celular ou do computador, sem instalar nada e sem gravador externo. Dá para adicionar à tela inicial e usar como um app comum.",
  },
  {
    term: "Quanto custa",
    detail: `Conta gratuita com ${formatCoins(INITIAL_COIN_BALANCE)} créditos e sem cartão. Assinaturas a partir de ${formatBrl(PLANS.pessoal.priceCents)} por mês, canceláveis a qualquer momento.`,
  },
];

function WhatIsScriba() {
  return (
    <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
      <div className="flex flex-col gap-4">
        <SectionLabel>O produto</SectionLabel>
        <h2 className="text-pretty text-[27px] font-semibold leading-[1.18] tracking-[-.02em] text-scriba-ink-strong lg:text-[38px]">
          O que é o Scriba, em quatro linhas.
        </h2>
        <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[16px]">
          Você põe seu nome nisso, então o produto vem primeiro. Aqui está o essencial; a página
          inicial mostra as telas funcionando.
        </p>
        <Link
          href="/"
          className="w-fit text-[13.5px] font-medium text-scriba-blue-ink underline underline-offset-4"
        >
          Ver a página do produto →
        </Link>
      </div>
      <dl className="flex flex-col">
        {DEFINITIONS.map((d, i) => (
          <div
            key={d.term}
            className={cn(
              "flex flex-col gap-1.5 py-4 sm:flex-row sm:gap-8 sm:py-[18px]",
              i > 0 && "border-t border-scriba-hairline"
            )}
          >
            <dt className="flex-none text-[13px] font-semibold leading-[1.5] text-scriba-ink-strong sm:w-[150px] sm:text-[13.5px]">
              {d.term}
            </dt>
            <dd className="min-w-0 text-pretty text-[13.5px] font-light leading-[1.62] text-scriba-ink-soft sm:text-[14.5px]">
              {d.detail}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- O que você tem para mostrar ---------- */

const SHOWCASE: { label: string; title: string; body: string; tone: "blue" | "mint" | "cream" }[] =
  [
    {
      label: "Durante o culto",
      title: "O feed ao vivo",
      body: "Enquanto o pregador fala, o app vai mostrando os versículos citados com o texto da passagem, o contexto histórico e as frases mais marcantes. Tudo aparece sozinho, na hora.",
      tone: "blue",
    },
    {
      label: "Depois do amém",
      title: "O resumo pronto",
      body: "Ideia central, pontos principais, versículos citados e aplicações para a semana. Fica pronto minutos depois do fim do culto, sem ninguém digitar uma linha.",
      tone: "mint",
    },
    {
      label: "Sem esperar domingo",
      title: "A importação do YouTube",
      body: "Cole o link de um culto que já está no YouTube e o Scriba monta o mesmo resumo a partir da legenda. É como demonstrar o app numa terça-feira, com um sermão que a pessoa já conhece.",
      tone: "cream",
    },
  ];

const SHOWCASE_TONES = {
  blue: "bg-scriba-blue-soft text-scriba-blue-ink",
  mint: "bg-scriba-mint text-scriba-mint-accent",
  cream: "bg-scriba-cream text-scriba-cream-accent",
} as const;

function WhatToShow() {
  return (
    <section className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[88px] lg:gap-12">
        <div className="flex max-w-[640px] flex-col gap-3">
          <SectionLabel color="blue">Material</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.02em] text-scriba-ink-strong lg:text-[40px]">
            Três coisas que você mostra em trinta segundos.
          </h2>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
          {SHOWCASE.map((item) => (
            <div
              key={item.title}
              className="lp-lift flex flex-col gap-3 rounded-[24px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_8px_26px_rgba(0,0,0,.09)] sm:rounded-[26px] sm:p-8"
            >
              <span
                className={cn(
                  "w-fit rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[.08em]",
                  SHOWCASE_TONES[item.tone]
                )}
              >
                {item.label}
              </span>
              <h3 className="text-[19px] font-semibold leading-[1.28] tracking-[-.012em] text-scriba-ink sm:text-[21px]">
                {item.title}
              </h3>
              <p className="text-pretty text-[13.5px] font-light leading-[1.62] text-scriba-ink-soft sm:text-[14px]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Como você é remunerado ---------- */

function HowYouEarn() {
  const rows = [PLANS.pessoal, PLANS.estudioso] as const;
  return (
    <section
      id="remuneracao"
      className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-12"
    >
      <div className="flex max-w-[680px] flex-col gap-3">
        <SectionLabel>A remuneração</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[42px]">
          Você ganha de duas formas: em dinheiro e em moedas.
        </h2>
        <p className="text-pretty text-[14px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[15.5px]">
          O dinheiro só entra quando alguém assina, e isso demora. As moedas entram a cada cadastro,
          bem antes disso. É proposital: você precisa ver algum resultado enquanto a primeira
          assinatura não vem.
        </p>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
        <EarnCard
          eyebrow="Em dinheiro"
          value={`${COMMISSION_PCT.toLocaleString("pt-BR")}%`}
          title="da primeira mensalidade"
          body="Uma vez por pessoa, sobre o valor cheio do plano que ela assinar. As mensalidades seguintes não geram nova comissão."
          strong
        />
        <EarnCard
          eyebrow="Em moedas"
          value={formatCoins(DEFAULT_PARTNER_SIGNUP_REWARD_COINS)}
          title="por cadastro no seu link"
          body="Por cada conta criada pelo seu link ou código, assine ela ou não. Entram no seu saldo na próxima vez que você abrir o app."
        />
        <EarnCard
          eyebrow="Em moedas"
          value={formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)}
          title="por mês, de cortesia"
          body="Todo mês, dê resultado ou não. São para você continuar gravando: quem não usa o produto não consegue falar dele."
        />
      </div>

      {/* O que o INDICADO ganha é argumento de venda do parceiro, não custo dele:
          é o que ele anuncia para converter. Fica ao lado do que ELE ganha, e
          não escondido na seção de regras. */}
      <p className="text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft">
        E quem entra pelo seu link começa com{" "}
        <strong className="font-semibold text-scriba-ink-strong">
          {formatCoins(REFERRED_TOTAL_COINS)} moedas
        </strong>{" "}
        em vez de {formatCoins(INITIAL_COIN_BALANCE)}, a melhor oferta que o Scriba tem, e ela só
        existe pelo link de um parceiro. É o que você tem para anunciar.
      </p>

      {/* A tabela existe porque "30% da primeira mensalidade" é fórmula, e o
          parceiro precisa do VALOR. Os dois números saem de `plans.ts`, o mesmo
          catálogo do checkout: se o preço mudar, esta linha muda junto. */}
      <div className="overflow-x-auto rounded-[24px] border border-scriba-hairline bg-scriba-paper">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="border-b border-scriba-hairline">
              <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[.1em] text-scriba-ink-mute">
                Plano
              </th>
              <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[.1em] text-scriba-ink-mute">
                Mensalidade
              </th>
              <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[.1em] text-scriba-ink-mute">
                Você recebe
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((plan) => (
              <tr key={plan.key} className="border-b border-scriba-hairline-soft last:border-b-0">
                <td className="px-6 py-4 text-[14px] font-medium text-scriba-ink-strong">
                  {plan.name}
                </td>
                <td className="px-6 py-4 text-[14px] font-light text-scriba-ink-soft">
                  {formatBrl(plan.priceCents)}/mês
                </td>
                <td className="px-6 py-4 text-right font-mono text-[14px] font-semibold text-scriba-green-ink">
                  {formatBrl(commissionCents(plan.priceCents, DEFAULT_COMMISSION_BPS))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-scriba-hairline px-6 py-4 text-[12.5px] font-light leading-[1.6] text-scriba-ink-mute">
          A conta é sobre o preço cheio que aparece no site: a taxa do cartão sai da nossa margem,
          não da sua. Assim você confere quanto tem a receber sem precisar acreditar em nós. O
          pagamento é por PIX, uma vez por mês, quando o disponível chega a{" "}
          {formatBrl(PAYOUT_MINIMUM_CENTS)}; abaixo disso o saldo espera o mês seguinte e nunca
          expira.
        </p>
      </div>
    </section>
  );
}

function EarnCard({
  eyebrow,
  value,
  title,
  body,
  strong,
}: {
  eyebrow: string;
  value: string;
  title: string;
  body: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[24px] bg-scriba-paper p-6 sm:rounded-[26px] sm:p-8",
        strong
          ? "border-[1.5px] border-scriba-blue shadow-[0_16px_40px_rgba(0,0,0,.16)]"
          : "border border-scriba-hairline"
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[.1em]",
          strong ? "text-scriba-blue-ink" : "text-scriba-ink-mute"
        )}
      >
        {eyebrow}
      </span>
      <span className="text-[40px] font-semibold leading-none tracking-[-.025em] text-scriba-ink-strong">
        {value}
      </span>
      <span className="text-[14px] font-medium text-scriba-ink">{title}</span>
      <p className="text-pretty text-[13px] font-light leading-[1.6] text-scriba-ink-soft">
        {body}
      </p>
    </div>
  );
}

/* ---------- O painel ---------- */

/**
 * A prévia do painel é markup ESTÁTICO, não o painel real.
 *
 * Mesma decisão dos mockups de celular da `/` (ver `app/AGENTS.md`): importar
 * a tela de verdade traria `PartnerTabs`, `EarningsByPlan` e o `RefreshPanelButton`,
 * todos `"use client"`, todos inúteis aqui, para o bundle de uma página que
 * ninguém clica. O preço é conhecido: mexer no painel não atualiza esta prévia.
 */
function Panel() {
  return (
    <section id="painel" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-[88px] lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-4">
          <SectionLabel color="blue">O painel</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.02em] text-scriba-ink-strong lg:text-[40px]">
            Você acompanha tudo sem precisar perguntar.
          </h2>
          <p className="max-w-[520px] text-pretty text-[14px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[15.5px]">
            Assim que você entra no programa, uma área sua aparece no menu do app. Ela responde
            primeiro a pergunta que importa, quanto você tem a receber, e só depois mostra de onde
            esse valor veio.
          </p>
          <ul className="flex flex-col gap-2.5 pt-1">
            {[
              "Quantas pessoas abriram seu link, uma contagem por pessoa, por dia.",
              "Quantas delas criaram conta, e quantas dessas viraram assinantes.",
              "Quanto está em carência, quanto entra no próximo PIX e quanto você já recebeu.",
              "O histórico mês a mês, com o comprovante de cada pagamento.",
              "Seu link e seu código, prontos para copiar.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-[3px] flex size-4 flex-none items-center justify-center rounded-full bg-scriba-blue-soft"
                >
                  <Check className="text-scriba-blue-ink" />
                </span>
                <span className="text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft">
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 rounded-[18px] border border-scriba-hairline bg-scriba-paper p-4 text-pretty text-[12.5px] font-light leading-[1.6] text-scriba-ink-soft">
            <strong className="font-semibold text-scriba-ink-strong">
              O painel mostra apenas números.
            </strong>{" "}
            Nome, e-mail ou qualquer dado de quem se cadastrou pelo seu link nunca aparecem para
            você, nem no painel, nem em relatório nenhum. Você vê "12 cadastros", nunca "estes 12".
          </p>
        </div>
        <PanelMock />
      </div>
    </section>
  );
}

function PanelMock() {
  return (
    <div className="flex flex-col gap-3 rounded-[26px] border border-scriba-hairline bg-scriba-paper p-5 shadow-[0_16px_40px_rgba(0,0,0,.12)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight text-scriba-ink-strong">
            Olá, Parceiro!
          </span>
          <span className="text-[11.5px] font-light text-scriba-ink-soft">
            Seus resultados e o que há a receber.
          </span>
        </div>
        <span className="rounded-full bg-scriba-blue-soft px-3 py-1 text-[10.5px] font-semibold text-scriba-blue-ink">
          /partners
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <MockMoney label="A liberar" value="R$ 41,79" hint="Carência de 30 dias" />
        <MockMoney label="Disponível" value="R$ 89,55" hint="Entra no próximo PIX" strong />
        <MockMoney label="Já recebido" value="R$ 214,92" hint="R$ 346,26 no total" />
      </div>

      <div className="flex flex-col gap-3 rounded-[18px] border border-scriba-hairline-soft p-4">
        <span className="text-[12.5px] font-semibold text-scriba-ink-strong">Seu funil</span>
        <div className="grid grid-cols-3 gap-3">
          <MockStep label="Visitas" value="1.284" hint="1.902 aberturas" />
          <MockStep label="Cadastros" value="176" hint="pelo link ou código" />
          <MockStep label="Assinantes" value="21" hint="11,9% dos cadastros" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-[16px] bg-scriba-btn-muted p-1">
        {["Divulgação", "Ganhos", "Pagamentos"].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "flex-1 rounded-[12px] py-1.5 text-center text-[11.5px] font-medium",
              i === 0
                ? "bg-scriba-paper text-scriba-ink-strong shadow-[0_2px_6px_rgba(0,0,0,.12)]"
                : "text-scriba-ink-mute"
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-[18px] border border-scriba-hairline-soft bg-scriba-cream p-4">
        <CoinMark size={20} className="mt-0.5 flex-none" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[12.5px] font-semibold text-scriba-cream-ink">
            {formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas por mês, por nossa conta
          </span>
          <span className="text-[11.5px] font-light leading-[1.5] text-scriba-cream-body">
            Caem sozinhas no começo de cada mês, para você usar o Scriba de verdade.
          </span>
        </div>
      </div>

      <p className="text-center text-[10.5px] font-light text-scriba-ink-mute">
        Ilustração do painel. Os números são fictícios.
      </p>
    </div>
  );
}

function MockMoney({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-[18px] border border-scriba-hairline-soft p-4",
        strong ? "bg-scriba-mint" : "bg-scriba-paper"
      )}
    >
      <span
        className={cn(
          "text-[9.5px] font-semibold uppercase tracking-[.12em]",
          strong ? "text-scriba-mint-accent" : "text-scriba-ink-mute"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[19px] font-semibold tracking-tight",
          strong ? "text-scriba-mint-dark" : "text-scriba-ink-strong"
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "text-[10.5px] font-light",
          strong ? "text-scriba-mint-body" : "text-scriba-ink-mute"
        )}
      >
        {hint}
      </span>
    </div>
  );
}

function MockStep({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[.1em] text-scriba-ink-mute">
        {label}
      </span>
      <span className="text-[18px] font-semibold tracking-tight text-scriba-ink-strong">
        {value}
      </span>
      <span className="text-[10.5px] font-light leading-[1.35] text-scriba-ink-soft">{hint}</span>
    </div>
  );
}

/* ---------- As regras ---------- */

const RULES: { title: string; body: string }[] = [
  {
    title: `Seu link vale por ${ATTRIBUTION_DAYS} dias`,
    body: `Quem abre seu link tem ${ATTRIBUTION_DAYS} dias para criar a conta e ainda contar como sua indicação. Se a pessoa viu no celular e foi se cadastrar no computador, ela pode digitar seu código na tela de cadastro.`,
  },
  {
    title: "A indicação é sua para sempre",
    body: "Criada a conta pelo seu link, ela conta como sua indicação e de mais ninguém. Nenhum link aberto depois transfere a pessoa para outro parceiro.",
  },
  {
    title: "A comissão é uma vez por pessoa",
    body: "Ela incide só sobre a primeira mensalidade que a pessoa pagar. Renovação não gera nova comissão, e quem cancela e volta meses depois também não. Compra avulsa de créditos não comissiona.",
  },
  {
    title: "O valor trava na primeira fatura",
    body: `Se a pessoa começar no ${PLANS.pessoal.name} e mudar para o ${PLANS.estudioso.name} depois, sua comissão continua sendo a do ${PLANS.pessoal.name}.`,
  },
  {
    title: `Carência de ${COMMISSION_HOLD_DAYS} dias`,
    body: `Toda comissão espera ${COMMISSION_HOLD_DAYS} dias antes de ficar disponível, é o prazo em que a cobrança ainda pode ser contestada no cartão. Havendo reembolso ou contestação, aquela comissão é cancelada.`,
  },
  {
    title: "Você não indica a si mesmo",
    body: "Sua própria conta nunca gera comissão nem bônus. Contas criadas em massa, tráfego comprado e promessa falsa sobre o produto encerram a participação, e comissão de indicação fraudulenta não é paga.",
  },
];

function Rules() {
  return (
    <section
      id="regras"
      className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-10"
    >
      <div className="flex flex-col gap-3 lg:max-w-[680px]">
        <SectionLabel>As regras</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que você precisa saber antes de publicar o primeiro link.
        </h2>
        <p className="text-pretty text-[14px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[15.5px]">
          Aqui está o essencial, em português claro. O texto completo, com definições, obrigações,
          condutas vedadas, impostos e desligamento, está no regulamento.
        </p>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
        {RULES.map((rule) => (
          <div
            key={rule.title}
            className="flex flex-col gap-2 rounded-[22px] border border-scriba-hairline bg-scriba-paper p-5 sm:p-6"
          >
            <h3 className="text-pretty text-[14.5px] font-semibold leading-[1.35] tracking-[-.01em] text-scriba-ink-strong">
              {rule.title}
            </h3>
            <p className="text-pretty text-[13px] font-light leading-[1.6] text-scriba-ink-soft">
              {rule.body}
            </p>
          </div>
        ))}
      </div>
      <Link
        href="/parceiros/regulamento"
        className="lp-cta-soft w-fit rounded-[24px] bg-scriba-btn-muted py-[15px] px-7 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-ink hover:bg-scriba-btn-muted-hover"
      >
        Ler o regulamento completo
      </Link>
    </section>
  );
}

/* ---------- Como entrar ---------- */

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Conheça, sem compromisso",
    body: `Crie sua conta por esta página e ganhe ${formatCoins(PARTNER_PROSPECT_COINS)} moedas. Grave um culto, importe um vídeo do YouTube, leia um resumo. Você não entrou em programa nenhum ainda, só está vendo se o produto faz sentido para o seu público.`,
  },
  {
    n: "02",
    title: "Se fizer sentido, fale com a gente",
    body: "Só aí começa o programa de verdade. Quem cadastra o parceiro é a equipe do Scriba: responda o convite que você recebeu, ou escreva para contato@scriba.cc contando onde você publica e para quem.",
  },
  {
    n: "03",
    title: "Receba link, código e painel",
    body: `Cadastramos você com sua chave PIX e o percentual combinado. Na primeira vez que abrir o app depois disso, as ${formatCoins(DEFAULT_PARTNER_MONTHLY_COINS)} moedas entram no seu saldo e a área do parceiro aparece no menu.`,
  },
];

function HowToJoin() {
  return (
    <section id="como-entrar" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[88px] lg:gap-12">
        <div className="flex max-w-[640px] flex-col gap-3">
          <SectionLabel color="blue">Como entrar</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.02em] text-scriba-ink-strong lg:text-[40px]">
            Três passos, e nenhum deles custa dinheiro.
          </h2>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="lp-lift flex flex-col gap-3 rounded-[24px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_8px_26px_rgba(0,0,0,.09)] sm:rounded-[26px] sm:p-8"
            >
              <span className="flex size-10 items-center justify-center rounded-[14px] bg-scriba-blue-soft text-[13px] font-semibold text-scriba-blue-ink">
                {step.n}
              </span>
              <h3 className="text-[18px] font-semibold leading-[1.28] tracking-[-.012em] text-scriba-ink sm:text-[20px]">
                {step.title}
              </h3>
              <p className="text-pretty text-[13.5px] font-light leading-[1.62] text-scriba-ink-soft sm:text-[14px]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Criar a conta já me compromete com alguma coisa?",
    answer: `Não. Criar conta por esta página só faz duas coisas: te dá ${formatCoins(PARTNER_PROSPECT_COINS)} moedas para usar o app e nos avisa que você tem interesse. Você não assinou nada, não tem meta, não tem prazo e pode simplesmente não voltar. Entrar no programa é um segundo passo, e depende das duas partes concordarem.`,
  },
  {
    question: "Preciso ter um canal grande?",
    answer:
      "Não. O que conta é a proximidade com quem ouve pregação, não o tamanho da audiência. Um líder de célula que fala com trinta pessoas todo domingo costuma trazer mais gente do que um perfil grande e distante.",
  },
  {
    question: "Preciso pagar alguma coisa para entrar?",
    answer:
      "Não. Não há taxa de adesão, mensalidade nem compra de kit. A conta é gratuita e as moedas de cortesia são nossas.",
  },
  {
    question: "Sou obrigado a falar só do Scriba?",
    answer:
      "Não há exclusividade nem meta mínima. Você publica quando e onde fizer sentido, bio, descrição de vídeo, stories, grupo de WhatsApp, boletim da igreja.",
  },
  {
    question: "Quando o dinheiro cai na conta?",
    answer: `Cada comissão espera ${COMMISSION_HOLD_DAYS} dias, é o tempo em que a cobrança ainda pode ser contestada no cartão. Passado o prazo, ela fica disponível e entra no PIX do mês seguinte, desde que o total disponível tenha chegado a ${formatBrl(PAYOUT_MINIMUM_CENTS)}.`,
  },
  {
    question: `E se eu não juntar os ${formatBrl(PAYOUT_MINIMUM_CENTS)}?`,
    answer:
      "O saldo continua acumulado para o mês seguinte e nunca expira. Se você decidir sair do programa, ele é pago integralmente, mesmo abaixo do mínimo.",
  },
  {
    question: "Eu vejo quem se cadastrou pelo meu link?",
    answer:
      "Não. O painel mostra só números, nenhum nome, e-mail ou dado de quem criou a conta chega até você. É uma decisão de projeto, não uma limitação técnica.",
  },
];

function Faq() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-12">
      <div className="flex flex-col gap-3 lg:items-center lg:text-center">
        <SectionLabel color="blue">Perguntas frequentes</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que costumam perguntar antes de aceitar o convite.
        </h2>
      </div>
      <div className="grid gap-x-[52px] gap-y-0 lg:grid-cols-2">
        {FAQ.map((item) => (
          <div
            key={item.question}
            className="flex flex-col gap-2 border-t border-scriba-hairline py-5 sm:py-6"
          >
            <h3 className="text-pretty text-[15px] font-semibold leading-[1.4] tracking-[-.01em] text-scriba-ink-strong sm:text-[16px]">
              {item.question}
            </h3>
            <p className="text-pretty text-[13.5px] font-light leading-[1.65] text-scriba-ink-soft sm:text-[14.5px]">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-11 sm:px-10 sm:py-24">
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-[30px] bg-[image:var(--lp-band)] p-9 text-white sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16">
        <div className="pointer-events-none absolute -top-[90px] right-[60px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.22)_0%,rgba(248,198,75,0)_70%)]" />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div className="text-pretty text-[28px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[38px]">
            Conheça a plataforma e veja se faz sentido para você.
          </div>
          <div className="text-[14px] font-light leading-[1.6] text-lp-band-ink lg:text-[16px] lg:leading-[1.62]">
            Crie sua conta gratuita, grave o culto deste domingo e decida com calma. Quando quiser
            entrar no programa, escreva para{" "}
            <a
              href="mailto:contato@scriba.cc?subject=Programa%20de%20Parceiros%20do%20Scriba"
              className="font-medium text-scriba-yellow-light underline underline-offset-4"
            >
              contato@scriba.cc
            </a>
            .
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <Link
            href={PROSPECT_ENTRY}
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-lp-band-cta py-[17px] px-[38px] text-[13px] font-semibold uppercase tracking-[.04em] text-lp-band-cta-ink shadow-[0_10px_24px_rgba(0,0,0,.2)]"
          >
            <ScribaMark size={20} />
            Criar conta grátis
          </Link>
          <div className="text-center text-[11px] font-light text-lp-band-ink lg:text-[11.5px]">
            Sem cartão e sem compromisso
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Átomos ---------- */

function Check({ className }: { className?: string }) {
  return (
    <svg
      role="presentation"
      className={cn("size-3 flex-none", className)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 8.5L6.5 12L13 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
