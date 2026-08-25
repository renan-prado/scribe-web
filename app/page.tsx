import Link from "next/link";
import { redirect } from "next/navigation";
import { Feed } from "@/features/session/components/Feed";
import { SummaryView } from "@/features/session/components/SummaryView";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: { absolute: "Scriba — Grave, entenda e viva o sermão" },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div className="w-full overflow-x-hidden bg-white text-scriba-ink-strong antialiased">
      <LandingStyles />
      <Header />
      <Hero />
      <Problem />
      <HowItWorks />
      <Resumo />
      <Biblioteca />
      <Testimonials />
      <Plans />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function LandingStyles() {
  return (
    <style>{`
      .lp-cta { transition: filter .18s ease, box-shadow .18s ease; }
      .lp-cta:hover { filter: brightness(.95); box-shadow: 0 14px 30px rgba(79,168,240,.4); }
      .lp-cta-yellow { transition: filter .18s ease, box-shadow .18s ease; }
      .lp-cta-yellow:hover { filter: brightness(.96); box-shadow: 0 14px 30px rgba(0,0,0,.28); }
      .lp-cta-outline { transition: background-color .18s ease, border-color .18s ease, color .18s ease; }
      .lp-cta-outline:hover { background-color: #F6FAFE !important; border-color: #C9D9E8 !important; color: #33414F !important; }
      .lp-cta-soft { transition: background-color .18s ease, color .18s ease; }
      .lp-cta-soft:hover { background-color: #EAF1F8 !important; color: #33414F !important; }
      .lp-link { transition: color .18s ease; }
      .lp-link:hover { color: #33414F !important; }
      .lp-link-footer { transition: color .18s ease; }
      .lp-link-footer:hover { color: #4A5A6A !important; }
      .lp-nav { transition: color .18s ease; }
      .lp-nav:hover { color: #33414F !important; }
      .lp-lift { transition: box-shadow .25s ease, border-color .25s ease; }
      .lp-lift:hover { box-shadow: 0 16px 36px rgba(79,168,240,.18); border-color: #D9E7F5 !important; }
      .lp-lift-plan { transition: box-shadow .25s ease, border-color .25s ease; }
      .lp-lift-plan:hover { box-shadow: 0 22px 48px rgba(79,168,240,.22); }
      .lp-tile { transition: box-shadow .25s ease, filter .25s ease; }
      .lp-tile:hover { box-shadow: 0 10px 22px rgba(79,168,240,.14); filter: brightness(.98); }
      html { scroll-padding-top: 84px; }
    `}</style>
  );
}

function Logo({ size = 28, textSize = 16.5 }: { size?: number; textSize?: number }) {
  return (
    <div className="flex items-center gap-[9px]">
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 249 249"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[#0F0D1E]"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M179 0C217.66 0 249 31.3401 249 70V179C249 217.66 217.66 249 179 249H70C31.3401 249 5.96018e-07 217.66 0 179V70C0 31.3401 31.3401 5.95941e-07 70 0H179ZM187.439 57.0098C159.551 59.2819 135.374 67.6406 115.574 81.8604C114.292 82.7832 113.634 84.3421 113.859 85.8994C115.091 94.2864 111.474 104.192 107.856 111.561C106.377 107.376 104.206 103.534 102.131 100.434C101.4 99.3431 100.207 98.6571 98.9023 98.5664C97.5913 98.4933 96.3203 99.0167 95.4541 99.9951C78.5287 119.267 72.9249 139.522 77.707 163.333L58.6504 182.391C56.4504 184.59 56.4504 188.145 58.6504 190.344C59.7463 191.441 61.1871 191.993 62.627 191.993C64.0668 191.993 65.5067 191.441 66.6035 190.344L114.899 142.048C117.098 139.849 120.655 139.849 122.854 142.048C125.053 144.248 125.053 147.802 122.854 150.002L99.9082 172.947C100.342 172.952 100.792 173.03 101.22 173.03C120.648 173.03 137.928 164.942 154.511 148.314C178.023 124.802 188.879 99.6637 191.984 61.5488C192.091 60.317 191.641 59.1019 190.764 58.2295C189.891 57.3585 188.694 56.9315 187.439 57.0098Z"
        />
      </svg>
      <div className="font-semibold tracking-[-.01em]" style={{ fontSize: textSize }}>
        Scriba
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-[14px] border-b border-scriba-hairline-soft">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3.5 sm:gap-8 sm:px-10 sm:py-[18px]">
        <Logo textSize={18} />
        <div className="hidden items-center gap-8 text-[13.5px] text-scriba-ink-soft lg:flex">
          <a href="#como-funciona" className="lp-nav">
            Como funciona
          </a>
          <a href="#recursos" className="lp-nav">
            Recursos
          </a>
          <a href="#planos" className="lp-nav">
            Planos
          </a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3.5">
          <Link
            href="/sign-in"
            className="lp-link hidden px-1 py-2.5 text-[13.5px] font-medium text-scriba-ink-soft lg:inline"
          >
            Entrar
          </Link>
          <Link
            href="/sign-in"
            className="lp-cta inline-flex items-center justify-center gap-2 rounded-[22px] bg-scriba-blue text-[12px] font-semibold uppercase tracking-[.04em] text-white shadow-[0_5px_14px_rgba(79,168,240,.3)] py-3 px-5"
          >
            {/** biome-ignore lint/performance/noImgElement: static asset in landing CTA */}
            <img src="/pena-logo-white.svg" alt="" aria-hidden width={14} height={14} />
            Começar
          </Link>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#F6FBFF_0%,#FFFFFF_100%)]">
      <div className="pointer-events-none absolute -top-[180px] -right-[140px] w-[620px] h-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]" />
      <div className="pointer-events-none absolute hidden lg:block -bottom-[120px] -left-[160px] w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pt-9 pb-2 sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:pt-[88px] lg:pb-24">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-[22px] border border-[#E3EEF8] bg-white px-3.5 py-[7px] pl-[9px] shadow-[0_4px_12px_rgba(79,168,240,.1)]">
            <div className="w-[10px] h-[5px] rounded-[3px] bg-scriba-yellow" />
            <div className="text-[10.5px] font-semibold tracking-[.03em] text-scriba-ink-soft">
              Ouça, relembre e coloque em prática.
            </div>
          </div>
          <h1 className="text-pretty text-[36px] leading-[1.08] font-semibold tracking-[-.025em] text-scriba-ink-strong lg:text-[60px] lg:leading-[1.06]">
            O sermão não termina quando você sai da igreja.
          </h1>
          <p className="max-w-[520px] text-pretty text-[14.5px] leading-[1.62] font-light text-scriba-ink-soft lg:text-[17.5px]">
            O Scriba escuta a pregação com você, organiza os principais ensinamentos e ajuda a
            relembrar e colocar em prática ao longo da semana.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/sign-in"
              className="lp-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-scriba-blue text-[13px] font-semibold uppercase tracking-[.04em] text-white shadow-[0_9px_22px_rgba(79,168,240,.3)] py-[17px] px-8"
            >
              {/** biome-ignore lint/performance/noImgElement: static asset in landing CTA */}
              <img src="/pena-logo-white.svg" alt="" aria-hidden width={16} height={16} />
              Começar grátis
            </Link>
            <a
              href="#recursos"
              className="lp-cta-outline inline-flex items-center justify-center rounded-[26px] border border-[#DFEAF4] bg-white text-[13px] font-medium text-scriba-ink py-4 px-7"
            >
              Conhecer o Scriba
            </a>
          </div>
          <div className="flex items-center gap-3.5 pt-1.5 sm:gap-5 sm:pt-3.5">
            <div className="flex">
              {[
                { bg: "#EAF4FE", fg: "#4FA8F0", txt: "MR" },
                { bg: "#E4EFEA", fg: "#4E8570", txt: "JS" },
                { bg: "#FDF3DD", fg: "#C79B2A", txt: "AL" },
                { bg: "#FAEAE5", fg: "#A8715C", txt: "DS" },
              ].map((a, i) => (
                <div
                  key={a.txt}
                  className="flex items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold w-[31px] h-[31px] sm:size-[34px] sm:text-[11px]"
                  style={{
                    background: a.bg,
                    color: a.fg,
                    marginLeft: i === 0 ? 0 : -9,
                  }}
                >
                  {a.txt}
                </div>
              ))}
            </div>
            <div className="text-[11.5px] leading-[1.5] font-light text-scriba-ink-soft sm:text-[12.5px]">
              <span className="font-semibold text-scriba-ink">12 mil sermões</span> registrados por
              membros de 340 igrejas.
            </div>
          </div>
        </div>
        <div className="-mx-5 flex min-w-0 justify-center overflow-hidden sm:mx-0 sm:overflow-visible">
          <PhoneFrame
            chrome={
              <PhoneChrome
                subtitle="Culto de domingo"
                title="Ensinamentos ao vivo"
                right={<LiveDot />}
              />
            }
          >
            <FeedMock />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-11 sm:px-10 sm:py-20 lg:gap-9 lg:pb-24">
      <SectionLabel>O problema</SectionLabel>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <h2 className="text-pretty text-[25px] leading-[1.32] font-medium tracking-[-.016em] text-scriba-ink-strong lg:text-[34px]">
          <span className="text-scriba-ink-mute">
            Você sai da igreja querendo lembrar de tudo.{" "}
          </span>
          Alguns dias depois, muita coisa já se perdeu.
        </h2>
        <div className="flex flex-col gap-3.5 lg:gap-[18px]">
          {PROBLEMS.map((p) => (
            <div key={p.n} className="flex items-start gap-3.5 sm:gap-4">
              <div
                className="flex flex-none items-center justify-center rounded-[11px] text-[13px] font-semibold w-[34px] h-[34px] sm:size-[38px] sm:rounded-[12px]"
                style={{
                  background: p.bg,
                  color: p.fg,
                }}
              >
                {p.n}
              </div>
              <div className="pt-1.5 text-pretty text-[13.5px] leading-[1.6] font-light text-scriba-ink-soft sm:text-[14.5px]">
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PROBLEMS = [
  {
    n: 1,
    bg: "#FAEAE5",
    fg: "#A8715C",
    body: "Anotar durante o sermão divide sua atenção: enquanto você escreve, deixa de acompanhar o que está sendo dito.",
  },
  {
    n: 2,
    bg: "#FDF3DD",
    fg: "#C79B2A",
    body: "Sem revisitar a mensagem, os detalhes desaparecem: uma frase importante, uma referência bíblica, uma aplicação para a semana.",
  },
  {
    n: 3,
    bg: "#EAF0FB",
    fg: "#6E82A8",
    body: "Com o tempo, fica difícil encontrar o que você ouviu: os sermões se acumulam, mas seus aprendizados não ficam organizados.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-scriba-surface border-scriba-hairline-soft border-y">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-[52px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <SectionLabel color="blue">Como funciona</SectionLabel>
          <h2 className="text-pretty text-[29px] leading-[1.16] font-semibold tracking-[-.02em] text-scriba-ink-strong lg:text-[42px]">
            Três passos, e o resto acontece sozinho.
          </h2>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
          <StepCard
            step="Passo 01"
            title="Acompanhe ao vivo"
            body="Enquanto você ouve, o Scriba identifica versículos e citações, explica contextos e destaca as frases mais importantes da pregação em tempo real."
            icon={
              <div className="flex size-11 items-center justify-center rounded-full bg-scriba-blue animate-scriba-halo">
                <div className="flex items-center gap-[2.5px]">
                  <span className="w-[2.5px] h-[10px] bg-white rounded-[2px]" />
                  <span className="w-[2.5px] h-[18px] bg-white rounded-[2px]" />
                  <span className="w-[2.5px] h-[13px] bg-white rounded-[2px]" />
                </div>
              </div>
            }
          />
          <StepCard
            step="Passo 02"
            title="Tenha tudo organizado"
            body="Depois do amém, você recebe um resumo completo com o tema central, os principais ensinamentos, versículos citados, frases marcantes e aplicações práticas."
            icon={
              <div className="flex size-11 items-center justify-center rounded-full bg-scriba-mint">
                <div className="w-[16px] h-[16px] rounded-[5px] border-[2.5px] border-scriba-mint-accent" />
              </div>
            }
          />
          <StepCard
            step="Passo 03"
            title="Continue a reflexão"
            body="Durante a semana, o Scriba ajuda você a relembrar a mensagem, colocá-la em prática e fazer conexões com outros sermões."
            icon={
              <div className="flex size-11 items-center justify-center rounded-full bg-scriba-cream">
                <div className="w-[16px] h-[16px] rounded-full border-[2.5px] border-scriba-cream-accent border-t-transparent" />
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  title,
  body,
  icon,
}: {
  step: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="lp-lift flex flex-col gap-3.5 rounded-[24px] border border-[#EAF2FA] bg-white p-6 shadow-[0_8px_26px_rgba(79,168,240,.09)] sm:rounded-[26px] sm:p-8">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-[.1em] uppercase text-scriba-ink-mute">
          {step}
        </div>
        {icon}
      </div>
      <div className="text-[19px] leading-[1.28] font-semibold tracking-[-.012em] text-scriba-ink sm:text-[21px]">
        {title}
      </div>
      <div className="text-pretty text-[13.5px] leading-[1.6] font-light text-scriba-ink-soft sm:text-[14px] sm:leading-[1.62]">
        {body}
      </div>
    </div>
  );
}

function Resumo() {
  return (
    <section id="recursos" className="mx-auto max-w-[1200px] px-5 py-12 sm:px-10 sm:py-24">
      <div className="flex flex-col items-center gap-8 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-16">
        <div className="order-2 -mx-5 flex min-w-0 justify-center overflow-hidden sm:mx-0 sm:overflow-visible lg:order-1">
          <PhoneFrame
            chrome={<PhoneChrome subtitle="Resumo · 41 min" title="A sede que só Cristo cura" />}
          >
            <SummaryMock />
          </PhoneFrame>
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:gap-[34px]">
          <div className="flex flex-col gap-3">
            <SectionLabel color="blue">O resumo</SectionLabel>
            <h2 className="text-pretty text-[29px] leading-[1.16] font-semibold tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
              Não é transcrição. É a mensagem, organizada.
            </h2>
            <p className="max-w-[520px] text-pretty text-[14.5px] leading-[1.62] font-light text-scriba-ink-soft lg:text-[16px] lg:leading-[1.65]">
              Ao final do sermão, o Scriba transforma tudo o que foi dito em um resumo claro, para
              você entender, encontrar e relembrar o que realmente importa.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
            {SUMMARY_BLOCKS.map((b) => (
              <div
                key={b.title}
                className="lp-tile flex flex-col gap-1.5 rounded-[18px] p-4 sm:rounded-[20px] sm:p-5"
                style={{ background: b.bg }}
              >
                <div className="text-[11.5px] font-semibold sm:text-[12px]" style={{ color: b.fg }}>
                  {b.title}
                </div>
                <div
                  className="text-[12px] leading-[1.5] font-light sm:text-[13px] sm:leading-[1.55]"
                  style={{ color: b.body }}
                >
                  {b.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const SUMMARY_BLOCKS = [
  {
    title: "Ideia central",
    text: "O ensinamento que conduz toda a mensagem, destacado logo no início.",
    bg: "#EAF4FE",
    fg: "#3E86C4",
    body: "#5E86AC",
  },
  {
    title: "Versículos citados",
    text: "As passagens mencionadas pelo pregador, reunidas com suas referências.",
    bg: "#FAEAE5",
    fg: "#A8715C",
    body: "#A08373",
  },
  {
    title: "Aplicações práticas",
    text: "Caminhos possíveis para levar o que você ouviu para a vida cotidiana.",
    bg: "#E4EFEA",
    fg: "#4E8570",
    body: "#6E8A7E",
  },
  {
    title: "Pontos principais",
    text: "O desenvolvimento do sermão organizado de forma clara e fácil de consultar.",
    bg: "#FDF3DD",
    fg: "#C79B2A",
    body: "#9C8A55",
  },
];

function Biblioteca() {
  return (
    <section className="relative overflow-hidden bg-scriba-blue">
      <div className="pointer-events-none absolute -top-[140px] -left-[100px] w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-8 px-5 py-12 text-white sm:px-10 sm:py-[88px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionLabel color="#FFDF8C">Sua biblioteca</SectionLabel>
          <h2 className="text-pretty text-[29px] leading-[1.16] font-semibold tracking-[-.022em] lg:text-[40px]">
            Anos de pregação, finalmente buscáveis.
          </h2>
          <p className="max-w-[500px] text-pretty text-[14.5px] leading-[1.62] font-light text-[#E2F1FF] lg:text-[16px] lg:leading-[1.65]">
            Busque por tema, versículo ou pregador. O Scriba também cruza sermões distantes no tempo
            e mostra quando dois deles falam da mesma coisa.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:pt-2">
            <BiblioCard
              title="Busca por significado"
              subtitle={`"aquele sermão sobre perdão na família"`}
              badge="3 resultados"
            />
            <BiblioCard
              title="Conexões automáticas"
              subtitle="Ansiedade · Confiança · Providência"
              badge="Novo"
            />
          </div>
        </div>
        <div className="-mx-5 flex min-w-0 justify-center overflow-hidden sm:mx-0 sm:overflow-visible">
          <PhoneFrame
            shadow="0 30px 62px rgba(20,66,105,.34)"
            chrome={
              <PhoneChrome
                subtitle="Biblioteca"
                title="Suas gravações"
                right={
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-scriba-blue-soft text-scriba-blue">
                    12
                  </span>
                }
              />
            }
          >
            <LibraryMock />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function BiblioCard({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-white/[.16] p-4 px-[17px] sm:px-[18px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] font-semibold sm:text-[13.5px]">{title}</div>
        <div className="text-[11.5px] font-light text-[#E2F1FF] sm:text-[12px]">{subtitle}</div>
      </div>
      <div className="flex-none whitespace-nowrap text-[11px] font-semibold tracking-[.04em] uppercase text-[#FFDF8C]">
        {badge}
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-3.5 px-5 py-11 sm:px-10 sm:py-24">
      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
        <TestimonialCard
          quote={`"Parei de anotar e comecei a ouvir de verdade. Na quarta-feira o app me devolve exatamente o ponto que eu precisava."`}
          name="Mateus Ribeiro"
          title="Membro · Igreja Batista Central"
          initials="MR"
        />
        <TestimonialCard
          quote={`"Uso com meu grupo pequeno. Chegamos na reunião falando do mesmo sermão, com as mesmas perguntas."`}
          name="Ana Laura Prado"
          title="Líder de grupo pequeno"
          initials="AL"
        />
        <TestimonialCard
          quote={`"Sei o que a igreja tem ouvido nos últimos dois anos. Isso mudou como eu planejo a pregação."`}
          name="Pr. João Silva"
          title="Pastor titular"
          initials="JS"
        />
      </div>
    </section>
  );
}

function TestimonialCard({
  quote,
  name,
  title,
  initials,
}: {
  quote: string;
  name: string;
  title: string;
  initials: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[24px] border border-[#EAF2FA] bg-white p-6 shadow-[0_8px_24px_rgba(79,168,240,.08)] sm:rounded-[26px] sm:p-8">
      <div className="text-pretty text-[15px] leading-[1.55] font-normal text-[#3D4C5B] sm:text-[16.5px]">
        {quote}
      </div>
      <div className="flex items-center gap-2.5 border-t border-[#EEF2F6] pt-[13px] sm:gap-[11px] sm:pt-[15px]">
        <div className="flex size-8 items-center justify-center rounded-full bg-scriba-blue-soft text-[10.5px] font-semibold text-scriba-blue sm:size-[34px]">
          {initials}
        </div>
        <div className="flex flex-col gap-px">
          <div className="text-[12.5px] font-semibold text-scriba-ink sm:text-[13px]">{name}</div>
          <div className="text-[11px] font-light text-scriba-ink-mute sm:text-[11.5px]">
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}

function Plans() {
  return (
    <section id="planos" className="bg-scriba-surface border-t border-scriba-hairline-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-12">
        <div className="flex flex-col gap-3 lg:items-center lg:text-center">
          <SectionLabel color="blue">Planos</SectionLabel>
          <h2 className="text-pretty text-[29px] leading-[1.16] font-semibold tracking-[-.022em] text-scriba-ink-strong lg:text-[42px] lg:leading-[1.14]">
            Comece grátis. Cresça quando fizer sentido.
          </h2>
          <p className="max-w-[520px] text-[13.5px] leading-[1.6] font-light text-scriba-ink-soft lg:text-[15.5px]">
            Sem contrato, sem cartão para testar. Cancele em um toque.
          </p>
        </div>
        <div className="grid items-start gap-4 [&>*:nth-child(2)]:order-first lg:grid-cols-3 lg:gap-[22px] lg:[&>*:nth-child(2)]:order-none">
          <PlanCard
            name="Pessoal"
            price="R$ 19,90"
            priceUnit="/mês"
            hint="2.000 créditos por mês"
            features={[
              "Sermão ao vivo",
              "Resumo organizado",
              "Referências bíblicas",
              "Destaques e principais ideias",
              "Biblioteca de sermões",
              "Aprofundar sermões",
            ]}
            cta="Escolher Pessoal"
            variant="soft"
            accent="#EAF4FE"
            comingSoon
          />
          <PlanCard
            name="Grátis"
            price="Grátis"
            hint="100 créditos para conhecer o Scriba"
            features={[
              "Sermão ao vivo",
              "Resumo organizado",
              "Referências bíblicas",
              "Destaques e principais ideias",
              "Biblioteca de sermões",
              "Aprofundar sermões",
            ]}
            cta="Começar grátis"
            variant="primary"
            accent="#4FA8F0"
          />
          <PlanCard
            name="Estudioso"
            price="R$ 44,90"
            priceUnit="/mês"
            hint="5.000 créditos por mês"
            features={[
              "Sermão ao vivo",
              "Resumo organizado",
              "Referências bíblicas",
              "Destaques e principais ideias",
              "Biblioteca de sermões",
              "Aprofundar sermões",
            ]}
            cta="Escolher Estudioso"
            variant="soft"
            accent="#EAF4FE"
            comingSoon
          />
        </div>
      </div>
    </section>
  );
}

function CoinHex({ size = 12 }: { size?: number }) {
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full bg-[#FFF3C4]"
      style={{ width: size + 6, height: size + 6 }}
    >
      <span
        className="bg-[#F8C64B] block"
        style={{
          width: size * 0.78,
          height: size * 0.89,
          clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        }}
      />
    </span>
  );
}

function PlanCard({
  name,
  price,
  priceUnit,
  hint,
  features,
  cta,
  variant,
  badge,
  comingSoon,
}: {
  name: string;
  price: string;
  priceUnit?: string;
  hint: string;
  features: string[];
  cta: string;
  variant: "primary" | "soft";
  accent: string;
  badge?: string;
  comingSoon?: boolean;
}) {
  const isPrimary = variant === "primary" && !comingSoon;
  return (
    <div
      className={`${comingSoon ? "" : "lp-lift-plan"} relative flex flex-col gap-[22px] rounded-[24px] bg-white p-6 sm:rounded-[26px] sm:p-8`}
      style={{
        border: isPrimary ? "1.5px solid #4FA8F0" : "1px solid #EAF2FA",
        boxShadow: isPrimary ? "0 16px 40px rgba(79,168,240,.18)" : undefined,
        filter: comingSoon ? "grayscale(1)" : undefined,
        opacity: comingSoon ? 0.45 : 1,
        pointerEvents: comingSoon ? "none" : undefined,
      }}
    >
      {comingSoon ? (
        <div className="absolute left-6 -top-[13px] rounded-[20px] bg-[#E8EEF4] text-[#637080] text-[10.5px] font-semibold tracking-[.06em] uppercase px-[14px] py-[6px] sm:left-7">
          Em breve
        </div>
      ) : badge ? (
        <div className="absolute left-6 -top-[13px] rounded-[20px] bg-scriba-yellow text-[#5A4409] text-[10.5px] font-semibold tracking-[.06em] uppercase px-[14px] py-[6px] sm:left-7">
          {badge}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div
          className={`text-[13px] font-semibold tracking-[.03em] ${isPrimary ? "text-scriba-blue" : "text-scriba-ink-soft"}`}
        >
          {name}
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-[36px] font-semibold tracking-[-.02em] text-scriba-ink-strong lg:text-[40px]">
            {price}
          </div>
          {priceUnit ? (
            <div className="text-[13px] font-light text-scriba-ink-mute lg:text-[13.5px]">
              {priceUnit}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] font-light text-scriba-ink-mute lg:text-[13px]">
          <CoinHex size={14} />
          {hint}
        </div>
      </div>
      <div className="h-px bg-scriba-hairline-soft" />
      <div className="flex flex-col gap-2.5 text-[13px] font-light text-scriba-ink-soft lg:text-[13.5px]">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5">
            <svg
              role="img"
              aria-label="Incluído"
              className="mt-0.5 flex-none"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8.5L6.5 12L13 5"
                stroke={isPrimary ? "#4FA8F0" : "#7A9BB5"}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {f}
          </div>
        ))}
      </div>
      {comingSoon ? (
        <div className="inline-flex cursor-not-allowed items-center justify-center rounded-[24px] bg-[#F0F4F8] text-[#9AABB8] text-[12px] font-semibold uppercase tracking-[.04em] p-[15px]">
          Em breve
        </div>
      ) : (
        <Link
          href="/sign-in"
          className={`${isPrimary ? "lp-cta" : "lp-cta-soft"} inline-flex items-center justify-center gap-2 rounded-[24px] text-[12px] font-semibold uppercase tracking-[.04em] p-[15px]`}
          style={{
            background: isPrimary ? "#4FA8F0" : "#F4F8FC",
            color: isPrimary ? "#fff" : "#4A5A6A",
            boxShadow: isPrimary ? "0 8px 20px rgba(79,168,240,.3)" : undefined,
          }}
        >
          {isPrimary ? (
            <>
              {/** biome-ignore lint/performance/noImgElement: static asset in landing CTA */}
              <img src="/pena-logo-white.svg" alt="" aria-hidden width={14} height={14} />
            </>
          ) : null}
          {cta}
        </Link>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-11 sm:px-10 sm:py-24">
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#33414F_0%,#1F5E92_100%)] p-9 text-white sm:gap-3.5 sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16">
        <div className="pointer-events-none absolute -top-[90px] right-[60px] w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.22)_0%,rgba(248,198,75,0)_70%)]" />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div className="text-pretty text-[28px] leading-[1.16] font-semibold tracking-[-.022em] lg:text-[38px]">
            Neste domingo, ouça sem medo de esquecer.
          </div>
          <div className="text-[14px] leading-[1.6] font-light text-[#CFE4F3] lg:text-[16px] lg:leading-[1.62]">
            Crie sua conta em menos de um minuto e grave seu primeiro sermão.
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <Link
            href="/sign-in"
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-scriba-yellow text-[#5A4409] text-[13px] font-semibold uppercase tracking-[.04em] shadow-[0_10px_24px_rgba(0,0,0,.2)] py-[17px] px-[38px]"
          >
            {/** biome-ignore lint/performance/noImgElement: static asset in landing CTA */}
            <img src="/pena-logo-white.svg" alt="" aria-hidden width={16} height={16} />
            Começar grátis
          </Link>
          <div className="text-center text-[11px] font-light text-[#AFCBE0] lg:text-[11.5px]">
            Sem cartão de crédito
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-scriba-hairline-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 sm:px-10 sm:py-11 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <Logo size={26} textSize={15} />
        <div className="flex flex-wrap gap-5 text-[12.5px] font-light text-scriba-ink-mute sm:gap-7">
          <a href="#recursos" className="lp-link-footer">
            Recursos
          </a>
          <a href="#planos" className="lp-link-footer">
            Planos
          </a>
          <a href="/privacy" className="lp-link-footer">
            Privacidade
          </a>
          <a href="mailto:oi@scriba.app" className="lp-link-footer">
            Contato
          </a>
        </div>
        <div className="text-[12px] font-light text-scriba-ink-mute">
          © {new Date().getFullYear()} Scriba
        </div>
      </div>
    </footer>
  );
}

function SectionLabel({ children, color = "mute" }: { children: React.ReactNode; color?: string }) {
  const colorClass =
    color === "blue" ? "text-scriba-blue" : color === "mute" ? "text-scriba-ink-mute" : undefined;
  return (
    <div
      className={`text-[11px] font-semibold tracking-[.12em] uppercase${colorClass ? ` ${colorClass}` : ""}`}
      style={colorClass ? undefined : { color }}
    >
      {children}
    </div>
  );
}

/* ---------- Phone mockups: real Feed / SummaryView inside a phone frame ---------- */

function PhoneFrame({
  children,
  shadow = "0 26px 54px rgba(29,90,140,.22)",
  chrome,
}: {
  children: React.ReactNode;
  shadow?: string;
  chrome?: React.ReactNode;
}) {
  return (
    <div
      className="relative flex-none w-[390px] scale-[.75] rounded-[44px] bg-white p-[11px] sm:scale-90 lg:scale-100"
      style={{ boxShadow: shadow }}
    >
      <div
        className="relative overflow-hidden rounded-[34px] bg-white h-[680px]"
        style={{
          maskImage: "linear-gradient(180deg, #000 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 82%, transparent 100%)",
        }}
      >
        {/* status bar */}
        <div className="absolute inset-x-0 top-0 z-10 flex h-[44px] items-center justify-between px-7 text-[12px] font-semibold text-[#3B4A5A]">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block w-[14px] h-[8px] border-[1.4px] border-[#3B4A5A] rounded-[2px]"
            />
          </div>
        </div>
        {/* notch */}
        <div className="absolute left-1/2 z-10 -translate-x-1/2 top-[12px] w-[104px] h-[26px] rounded-[16px] bg-[#0B1220]" />
        {chrome ? (
          <div className="absolute inset-x-0 top-[44px] z-[5] bg-white/95 backdrop-blur">
            {chrome}
          </div>
        ) : null}
        <div className={chrome ? "pt-[108px]" : "pt-[52px]"}>{children}</div>
      </div>
    </div>
  );
}

function PhoneChrome({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-scriba-hairline-soft px-5 pb-3 pt-2">
      <div className="flex min-w-0 flex-col">
        {subtitle ? (
          <span className="truncate text-[10px] font-semibold tracking-[.12em] uppercase text-scriba-ink-mute">
            {subtitle}
          </span>
        ) : null}
        <span className="truncate text-[15px] font-semibold tracking-[-.01em] text-scriba-ink-strong">
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

function LiveDot() {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-red-600/[.08] px-2.5 py-1">
      <span className="size-1.5 rounded-full bg-[#DC2626] shadow-[0_0_0_4px_rgba(220,38,38,.15)]" />
      <span className="text-[10px] font-bold tracking-[.08em] text-[#B91C1C]">AO VIVO</span>
    </div>
  );
}

const DEMO_FEED_ITEMS: FeedItem[] = [
  {
    kind: "speakerHighlight",
    text: "Jesus não oferece apenas água para a sede. Ele revela a sede que aquela mulher ainda não sabia nomear.",
  },
  {
    kind: "context",
    label: "Judeus e samaritanos",
    text: "A conversa em João 4 rompe barreiras religiosas, étnicas e sociais. Ao pedir água a uma mulher samaritana, Jesus se aproxima de alguém que muitos judeus evitariam e transforma um encontro improvável em revelação.",
    source: "Contexto histórico de João 4",
  },
  {
    kind: "speakerCitation",
    text: "Fizeste-nos para Ti, e inquieto está o nosso coração enquanto não repousa em Ti.",
    author: "Agostinho, citado pelo pregador",
  },
  {
    kind: "suggestedQuote",
    text: "O meu povo cometeu dois males: abandonou a mim, a fonte de água viva, e cavou as suas próprias cisternas.",
    author: "Jeremias 2:13",
    reason: "Conecta a água viva oferecida por Jesus às falsas fontes onde buscamos satisfação.",
  },
  {
    kind: "speakerEcho",
    text: "Cristo não veio apenas melhorar as nossas cisternas. Veio nos levar de volta à fonte.",
  },
];

const DEMO_SUMMARY: SummaryPayload = {
  thinking: "",
  title: "A água viva para corações sedentos",
  shortSummary:
    "Em João 4, Jesus revela que nossa sede mais profunda não pode ser satisfeita pelas fontes deste mundo.",
  blocks: [
    {
      type: "h1",
      text: "A água viva para corações sedentos",
    },
    {
      type: "paragraph",
      text: "À beira do poço de Jacó, Jesus inicia uma conversa improvável com uma mulher samaritana. Ao pedir água, ele atravessa barreiras religiosas, étnicas e sociais.",
    },
    {
      type: "highlight",
      text: "Jesus não oferece apenas água para a sede. Ele revela a sede que aquela mulher ainda não sabia nomear.",
    },
    {
      type: "h2",
      text: "As cisternas que não podem nos saciar",
    },
    {
      type: "paragraph",
      text: "Assim como a samaritana voltaria ao poço depois de beber, também retornamos às mesmas fontes em busca de satisfação: aprovação, relacionamentos, conquistas e conforto. Elas aliviam por um momento, mas não alcançam a sede mais profunda do coração.",
    },
    {
      type: "example",
      text: "É possível conquistar aquilo que desejávamos e, pouco tempo depois, sentir novamente o mesmo vazio. O problema não está apenas no que buscamos, mas no que esperamos que essas coisas façam por nós.",
    },
    {
      type: "h2",
      text: "Conhecidos por inteiro, amados por completo",
    },
    {
      type: "paragraph",
      text: "Jesus conhece a história daquela mulher e ainda assim permanece diante dela. Ele não revela seu passado para afastá-la, mas para mostrar que a água viva é oferecida a pessoas plenamente conhecidas e graciosamente alcançadas.",
    },
    {
      type: "quote",
      text: "Fizeste-nos para Ti, e inquieto está o nosso coração enquanto não repousa em Ti.",
      author: "Agostinho",
    },
    {
      type: "conclusion",
      text: "Cristo não veio apenas melhorar as cisternas que construímos. Ele veio nos levar de volta à fonte. Nele, nossa sede encontra descanso e nossa vida se transforma em verdadeira adoração.",
    },
  ],
};

function FeedMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
      <Feed items={DEMO_FEED_ITEMS} running hasTranscript suggesting />
    </div>
  );
}

function SummaryMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
      <SummaryView summary={DEMO_SUMMARY} hasTranscript running={false} />
    </div>
  );
}

function LibraryMock() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-3 pb-8">
      {LIB_GROUPS.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="text-xs font-semibold text-scriba-blue">{group.label}</span>
            <span className="h-px flex-1 bg-scriba-hairline" />
            <span className="text-[11px] font-light text-scriba-ink-mute">
              {group.items.length}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {group.items.map((s) => (
              <li
                key={s.title}
                className="rounded-3xl border border-scriba-hairline-soft bg-white p-4 shadow-[0_4px_14px_rgba(79,168,240,0.08)]"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-pretty text-[15px] font-semibold leading-tight tracking-tight text-scriba-ink-strong">
                    {s.title}
                  </span>
                  <span className="text-pretty text-[13px] font-light leading-snug text-scriba-ink-soft">
                    {s.summary}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
                    <span className="text-[12px] font-medium text-scriba-ink">{s.speaker}</span>
                    <span className="text-scriba-ink-mute">·</span>
                    <span className="text-[11px] font-light text-scriba-ink-mute">
                      {s.location}
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-scriba-hairline pt-2.5">
                  <span className="text-[11px] font-light text-scriba-ink-mute">{s.date}</span>
                  <span className="size-[3px] rounded-full bg-[rgba(169,181,196,.6)]" />
                  <span className="text-[11px] font-light text-scriba-ink-mute">{s.duration}</span>
                  <div className="flex-1" />
                  <span className="rounded-full bg-scriba-blue-soft px-3.5 py-1.5 text-[11px] font-semibold text-scriba-blue">
                    Ver resumo →
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const LIB_GROUPS = [
  {
    label: "Esta semana",
    items: [
      {
        title: "A sede que só Cristo cura",
        summary: "A samaritana no poço e as fontes que nunca saciam.",
        speaker: "Pr. João Silva",
        location: "IBC · Domingo",
        date: "24 ago",
        duration: "41 min",
      },
    ],
  },
  {
    label: "Semana passada",
    items: [
      {
        title: "Quando o perdão custa caro",
        summary: "O servo mal agradecido e o preço da graça recebida.",
        speaker: "Pr. João Silva",
        location: "Mateus 18",
        date: "17 ago",
        duration: "38 min",
      },
      {
        title: "A casa que Deus edifica",
        summary: "Salmo 127 e a diferença entre construir e ser edificado.",
        speaker: "Pr. Roberto Nunes",
        location: "Culto de família",
        date: "13 ago",
        duration: "34 min",
      },
    ],
  },
];
