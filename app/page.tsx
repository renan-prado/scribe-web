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

const BLUE = "#4FA8F0";
const YELLOW = "#F8C64B";
const INK_STRONG = "#2B3947";
const INK = "#33414F";
const INK_SOFT = "#6E7C8B";
const INK_MUTE = "#9BA6B3";
const HAIRLINE = "#EEF4FA";
const SURFACE = "#F6FBFF";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div
      className="w-full overflow-x-hidden bg-white text-[#33414F] antialiased"
      style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
    >
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
        style={{ color: "#0F0D1E" }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M179 0C217.66 0 249 31.3401 249 70V179C249 217.66 217.66 249 179 249H70C31.3401 249 5.96018e-07 217.66 0 179V70C0 31.3401 31.3401 5.95941e-07 70 0H179ZM187.439 57.0098C159.551 59.2819 135.374 67.6406 115.574 81.8604C114.292 82.7832 113.634 84.3421 113.859 85.8994C115.091 94.2864 111.474 104.192 107.856 111.561C106.377 107.376 104.206 103.534 102.131 100.434C101.4 99.3431 100.207 98.6571 98.9023 98.5664C97.5913 98.4933 96.3203 99.0167 95.4541 99.9951C78.5287 119.267 72.9249 139.522 77.707 163.333L58.6504 182.391C56.4504 184.59 56.4504 188.145 58.6504 190.344C59.7463 191.441 61.1871 191.993 62.627 191.993C64.0668 191.993 65.5067 191.441 66.6035 190.344L114.899 142.048C117.098 139.849 120.655 139.849 122.854 142.048C125.053 144.248 125.053 147.802 122.854 150.002L99.9082 172.947C100.342 172.952 100.792 173.03 101.22 173.03C120.648 173.03 137.928 164.942 154.511 148.314C178.023 124.802 188.879 99.6637 191.984 61.5488C192.091 60.317 191.641 59.1019 190.764 58.2295C189.891 57.3585 188.694 56.9315 187.439 57.0098Z"
        />
      </svg>
      <div style={{ fontSize: textSize, fontWeight: 600, letterSpacing: "-.01em" }}>Scriba</div>
    </div>
  );
}

function Header() {
  return (
    <div
      className="sticky top-0 z-40"
      style={{
        background: "rgba(255,255,255,.9)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3.5 sm:gap-8 sm:px-10 sm:py-[18px]">
        <Logo textSize={18} />
        <div
          className="hidden items-center gap-8 lg:flex"
          style={{ fontSize: 13.5, color: INK_SOFT }}
        >
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
            className="lp-link hidden px-1 py-2.5 font-medium lg:inline"
            style={{ fontSize: 13.5, color: INK_SOFT }}
          >
            Entrar
          </Link>
          <Link
            href="/sign-in"
            className="lp-cta inline-flex items-center justify-center rounded-[22px] font-semibold uppercase text-white"
            style={{
              background: BLUE,
              fontSize: 12,
              letterSpacing: ".04em",
              padding: "12px 20px",
              boxShadow: "0 5px 14px rgba(79,168,240,.3)",
            }}
          >
            Começar
          </Link>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#F6FBFF 0%,#FFFFFF 100%)" }}
    >
      <div
        className="pointer-events-none absolute"
        style={{
          top: -180,
          right: -140,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(79,168,240,.16) 0%,rgba(79,168,240,0) 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute hidden lg:block"
        style={{
          bottom: -120,
          left: -160,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(248,198,75,.16) 0%,rgba(248,198,75,0) 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pt-9 pb-2 sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:pt-[88px] lg:pb-24">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <div
            className="inline-flex items-center gap-2 self-start rounded-[22px] border bg-white px-3.5 py-[7px] pl-[9px]"
            style={{ borderColor: "#E3EEF8", boxShadow: "0 4px 12px rgba(79,168,240,.1)" }}
          >
            <div style={{ width: 10, height: 5, borderRadius: 3, background: YELLOW }} />
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".03em",
                color: INK_SOFT,
              }}
            >
              Ouça, relembre e coloque em prática.
            </div>
          </div>
          <h1
            className="text-[36px] leading-[1.08] text-pretty lg:text-[60px] lg:leading-[1.06]"
            style={{
              fontWeight: 600,
              letterSpacing: "-.025em",
              color: INK_STRONG,
            }}
          >
            O sermão não termina quando você sai da igreja.
          </h1>
          <p
            className="max-w-[520px] text-pretty text-[14.5px] leading-[1.62] lg:text-[17.5px]"
            style={{ fontWeight: 300, color: INK_SOFT }}
          >
            O Scriba escuta a pregação com você, organiza os principais ensinamentos e ajuda a
            relembrar e colocar em prática ao longo da semana.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/sign-in"
              className="lp-cta inline-flex items-center justify-center rounded-[26px] font-semibold uppercase text-white"
              style={{
                background: BLUE,
                fontSize: 13,
                letterSpacing: ".04em",
                padding: "17px 32px",
                boxShadow: "0 9px 22px rgba(79,168,240,.3)",
              }}
            >
              Começar grátis
            </Link>
            <a
              href="#recursos"
              className="lp-cta-outline inline-flex items-center justify-center rounded-[26px] border bg-white font-medium"
              style={{
                borderColor: "#DFEAF4",
                color: "#4A5A6A",
                fontSize: 13,
                padding: "16px 28px",
              }}
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
                  className="flex items-center justify-center rounded-full border-2 border-white font-semibold sm:size-[34px] sm:text-[11px]"
                  style={{
                    width: 31,
                    height: 31,
                    background: a.bg,
                    color: a.fg,
                    fontSize: 10,
                    marginLeft: i === 0 ? 0 : -9,
                  }}
                >
                  {a.txt}
                </div>
              ))}
            </div>
            <div
              className="text-[11.5px] leading-[1.5] sm:text-[12.5px]"
              style={{ fontWeight: 300, color: "#8C98A6" }}
            >
              <span style={{ fontWeight: 600, color: "#4A5A6A" }}>12 mil sermões</span> registrados
              por membros de 340 igrejas.
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
        <h2
          className="text-pretty text-[25px] leading-[1.32] lg:text-[34px]"
          style={{ fontWeight: 500, letterSpacing: "-.016em", color: INK_STRONG }}
        >
          <span style={{ color: "#8C98A6" }}>Você sai da igreja querendo lembrar de tudo. </span>
          Alguns dias depois, muita coisa já se perdeu.
        </h2>
        <div className="flex flex-col gap-3.5 lg:gap-[18px]">
          {PROBLEMS.map((p) => (
            <div key={p.n} className="flex items-start gap-3.5 sm:gap-4">
              <div
                className="flex flex-none items-center justify-center rounded-[11px] font-semibold sm:size-[38px] sm:rounded-[12px]"
                style={{
                  width: 34,
                  height: 34,
                  background: p.bg,
                  color: p.fg,
                  fontSize: 13,
                }}
              >
                {p.n}
              </div>
              <div
                className="pt-1.5 text-pretty text-[13.5px] leading-[1.6] sm:text-[14.5px]"
                style={{ fontWeight: 300, color: INK_SOFT }}
              >
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
    <section
      id="como-funciona"
      style={{
        background: SURFACE,
        borderTop: `1px solid ${HAIRLINE}`,
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-[52px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <SectionLabel color={BLUE}>Como funciona</SectionLabel>
          <h2
            className="text-pretty text-[29px] leading-[1.16] lg:text-[42px]"
            style={{ fontWeight: 600, letterSpacing: "-.02em", color: INK_STRONG }}
          >
            Três passos, e o resto acontece sozinho.
          </h2>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
          <StepCard
            step="Passo 01"
            title="Acompanhe ao vivo"
            body="Enquanto você ouve, o Scriba identifica versículos e citações, explica contextos e destaca as frases mais importantes da pregação em tempo real."
            icon={
              <div
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: BLUE, animation: "scriba-halo 2.6s ease-out infinite" }}
              >
                <div className="flex items-center gap-[2.5px]">
                  <span style={{ width: 2.5, height: 10, background: "#fff", borderRadius: 2 }} />
                  <span style={{ width: 2.5, height: 18, background: "#fff", borderRadius: 2 }} />
                  <span style={{ width: 2.5, height: 13, background: "#fff", borderRadius: 2 }} />
                </div>
              </div>
            }
          />
          <StepCard
            step="Passo 02"
            title="Tenha tudo organizado"
            body="Depois do amém, você recebe um resumo completo com o tema central, os principais ensinamentos, versículos citados, frases marcantes e aplicações práticas."
            icon={
              <div
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: "#E4EFEA" }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    border: "2.5px solid #4E8570",
                  }}
                />
              </div>
            }
          />
          <StepCard
            step="Passo 03"
            title="Continue a reflexão"
            body="Durante a semana, o Scriba ajuda você a relembrar a mensagem, colocá-la em prática e fazer conexões com outros sermões."
            icon={
              <div
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: "#FDF3DD" }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2.5px solid #C79B2A",
                    borderTopColor: "transparent",
                  }}
                />
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
    <div
      className="lp-lift flex flex-col gap-3.5 rounded-[24px] border bg-white p-6 sm:rounded-[26px] sm:p-8"
      style={{
        borderColor: "#EAF2FA",
        boxShadow: "0 8px 26px rgba(79,168,240,.09)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#A9B5C2",
          }}
        >
          {step}
        </div>
        {icon}
      </div>
      <div
        className="text-[19px] leading-[1.28] sm:text-[21px]"
        style={{ fontWeight: 600, letterSpacing: "-.012em", color: INK }}
      >
        {title}
      </div>
      <div
        className="text-pretty text-[13.5px] leading-[1.6] sm:text-[14px] sm:leading-[1.62]"
        style={{ fontWeight: 300, color: "#8C98A6" }}
      >
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
            <SectionLabel color={BLUE}>O resumo</SectionLabel>
            <h2
              className="text-pretty text-[29px] leading-[1.16] lg:text-[40px]"
              style={{ fontWeight: 600, letterSpacing: "-.022em", color: INK_STRONG }}
            >
              Não é transcrição. É a mensagem, organizada.
            </h2>
            <p
              className="max-w-[520px] text-pretty text-[14.5px] leading-[1.62] lg:text-[16px] lg:leading-[1.65]"
              style={{ fontWeight: 300, color: INK_SOFT }}
            >
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
                <div
                  className="text-[11.5px] sm:text-[12px]"
                  style={{ fontWeight: 600, color: b.fg }}
                >
                  {b.title}
                </div>
                <div
                  className="text-[12px] leading-[1.5] sm:text-[13px] sm:leading-[1.55]"
                  style={{ fontWeight: 300, color: b.body }}
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
    <section className="relative overflow-hidden" style={{ background: BLUE }}>
      <div
        className="pointer-events-none absolute"
        style={{
          top: -140,
          left: -100,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-8 px-5 py-12 text-white sm:px-10 sm:py-[88px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionLabel color="#FFDF8C">Sua biblioteca</SectionLabel>
          <h2
            className="text-pretty text-[29px] leading-[1.16] lg:text-[40px]"
            style={{ fontWeight: 600, letterSpacing: "-.022em" }}
          >
            Anos de pregação, finalmente buscáveis.
          </h2>
          <p
            className="max-w-[500px] text-pretty text-[14.5px] leading-[1.62] lg:text-[16px] lg:leading-[1.65]"
            style={{ fontWeight: 300, color: "#E2F1FF" }}
          >
            Busque por tema, versículo ou pregador. O Scriba também cruza sermões distantes no tempo
            e mostra quando dois deles falam da mesma coisa.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:pt-2">
            <BiblioCard
              title="Busca por significado"
              subtitle={`“aquele sermão sobre perdão na família”`}
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
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    style={{ background: "var(--scriba-blue-soft)", color: "var(--scriba-blue)" }}
                  >
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
    <div
      className="flex items-center justify-between gap-4 rounded-[18px] p-4 px-[17px] sm:px-[18px]"
      style={{ background: "rgba(255,255,255,.16)" }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] font-semibold sm:text-[13.5px]">{title}</div>
        <div className="text-[11.5px] sm:text-[12px]" style={{ fontWeight: 300, color: "#E2F1FF" }}>
          {subtitle}
        </div>
      </div>
      <div
        className="flex-none whitespace-nowrap"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "#FFDF8C",
        }}
      >
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
          quote={
            "“Parei de anotar e comecei a ouvir de verdade. Na quarta-feira o app me devolve exatamente o ponto que eu precisava.”"
          }
          name="Mateus Ribeiro"
          title="Membro · Igreja Batista Central"
          initials="MR"
          bg="#fff"
          border="#EAF2FA"
          quoteColor="#3D4C5B"
          nameColor="#4A5A6A"
          roleColor="#9BA6B3"
          avatarBg="#EAF4FE"
          avatarFg="#4FA8F0"
          divider="#EEF2F6"
        />
        <TestimonialCard
          quote={
            "“Uso com meu grupo pequeno. Chegamos na reunião falando do mesmo sermão, com as mesmas perguntas.”"
          }
          name="Ana Laura Prado"
          title="Líder de grupo pequeno"
          initials="AL"
          bg="#fff"
          border="#EAF2FA"
          quoteColor="#3D4C5B"
          nameColor="#4A5A6A"
          roleColor="#9BA6B3"
          avatarBg="#EAF4FE"
          avatarFg="#4FA8F0"
          divider="#EEF2F6"
        />
        <TestimonialCard
          quote={
            "“Sei o que a igreja tem ouvido nos últimos dois anos. Isso mudou como eu planejo a pregação.”"
          }
          name="Pr. João Silva"
          title="Pastor titular"
          initials="JS"
          bg="#fff"
          border="#EAF2FA"
          quoteColor="#3D4C5B"
          nameColor="#4A5A6A"
          roleColor="#9BA6B3"
          avatarBg="#EAF4FE"
          avatarFg="#4FA8F0"
          divider="#EEF2F6"
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
  bg,
  border,
  quoteColor,
  nameColor,
  roleColor,
  avatarBg,
  avatarFg,
  divider,
}: {
  quote: string;
  name: string;
  title: string;
  initials: string;
  bg: string;
  border?: string;
  quoteColor: string;
  nameColor: string;
  roleColor: string;
  avatarBg: string;
  avatarFg: string;
  divider: string;
}) {
  return (
    <div
      className="flex flex-col gap-3.5 rounded-[24px] p-6 sm:rounded-[26px] sm:p-8"
      style={{
        background: bg,
        border: border ? `1px solid ${border}` : undefined,
        boxShadow: border ? "0 8px 24px rgba(79,168,240,.08)" : undefined,
      }}
    >
      <div
        className="text-pretty text-[15px] leading-[1.55] sm:text-[16.5px]"
        style={{ fontWeight: 400, color: quoteColor }}
      >
        {quote}
      </div>
      <div
        className="flex items-center gap-2.5 pt-[13px] sm:gap-[11px] sm:pt-[15px]"
        style={{ borderTop: `1px solid ${divider}` }}
      >
        <div
          className="flex size-8 items-center justify-center rounded-full sm:size-[34px]"
          style={{
            background: avatarBg,
            color: avatarFg,
            fontSize: 10.5,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
        <div className="flex flex-col gap-px">
          <div
            className="text-[12.5px] sm:text-[13px]"
            style={{ fontWeight: 600, color: nameColor }}
          >
            {name}
          </div>
          <div
            className="text-[11px] sm:text-[11.5px]"
            style={{ fontWeight: 300, color: roleColor }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}

function Plans() {
  return (
    <section id="planos" style={{ background: SURFACE, borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-12">
        <div className="flex flex-col gap-3 lg:items-center lg:text-center">
          <SectionLabel color={BLUE}>Planos</SectionLabel>
          <h2
            className="text-pretty text-[29px] leading-[1.16] lg:text-[42px] lg:leading-[1.14]"
            style={{ fontWeight: 600, letterSpacing: "-.022em", color: INK_STRONG }}
          >
            Comece grátis. Cresça quando fizer sentido.
          </h2>
          <p
            className="max-w-[520px] text-[13.5px] leading-[1.6] lg:text-[15.5px]"
            style={{ fontWeight: 300, color: "#8C98A6" }}
          >
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
            accent={BLUE}
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
        className="bg-[#F8C64B]"
        style={{
          display: "block",
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
        border: isPrimary ? `1.5px solid ${BLUE}` : "1px solid #EAF2FA",
        boxShadow: isPrimary ? "0 16px 40px rgba(79,168,240,.18)" : undefined,
        filter: comingSoon ? "grayscale(1)" : undefined,
        opacity: comingSoon ? 0.45 : 1,
        pointerEvents: comingSoon ? "none" : undefined,
      }}
    >
      {comingSoon ? (
        <div
          className="absolute left-6 sm:left-7"
          style={{
            top: -13,
            background: "#E8EEF4",
            color: "#637080",
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            padding: "6px 14px",
            borderRadius: 20,
          }}
        >
          Em breve
        </div>
      ) : badge ? (
        <div
          className="absolute left-6 sm:left-7"
          style={{
            top: -13,
            background: YELLOW,
            color: "#5A4409",
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            padding: "6px 14px",
            borderRadius: 20,
          }}
        >
          {badge}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: ".03em",
            color: isPrimary ? BLUE : INK_SOFT,
          }}
        >
          {name}
        </div>
        <div className="flex items-baseline gap-1.5">
          <div
            className="text-[36px] lg:text-[40px]"
            style={{ fontWeight: 600, letterSpacing: "-.02em", color: INK_STRONG }}
          >
            {price}
          </div>
          {priceUnit ? (
            <div
              className="text-[13px] lg:text-[13.5px]"
              style={{ fontWeight: 300, color: INK_MUTE }}
            >
              {priceUnit}
            </div>
          ) : null}
        </div>
        <div
          className="flex items-center gap-1.5 text-[12.5px] lg:text-[13px]"
          style={{ fontWeight: 300, color: INK_MUTE }}
        >
          <CoinHex size={14} />
          {hint}
        </div>
      </div>
      <div className="h-px" style={{ background: HAIRLINE }} />
      <div
        className="flex flex-col gap-2.5 text-[13px] lg:text-[13.5px]"
        style={{ fontWeight: 300, color: INK_SOFT }}
      >
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
                stroke={isPrimary ? BLUE : "#7A9BB5"}
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
        <div
          className="inline-flex cursor-not-allowed items-center justify-center rounded-[24px] font-semibold uppercase"
          style={{
            background: "#F0F4F8",
            color: "#9AABB8",
            fontSize: 12,
            letterSpacing: ".04em",
            padding: 15,
          }}
        >
          Em breve
        </div>
      ) : (
        <Link
          href="/sign-in"
          className={`${isPrimary ? "lp-cta" : "lp-cta-soft"} inline-flex items-center justify-center rounded-[24px] font-semibold uppercase`}
          style={{
            background: isPrimary ? BLUE : "#F4F8FC",
            color: isPrimary ? "#fff" : "#4A5A6A",
            fontSize: 12,
            letterSpacing: ".04em",
            padding: 15,
            boxShadow: isPrimary ? "0 8px 20px rgba(79,168,240,.3)" : undefined,
          }}
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-11 sm:px-10 sm:py-24">
      <div
        className="relative flex flex-col gap-4 overflow-hidden rounded-[30px] p-9 text-white sm:gap-3.5 sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16"
        style={{ background: "linear-gradient(135deg,#33414F 0%,#1F5E92 100%)" }}
      >
        <div
          className="pointer-events-none absolute"
          style={{
            top: -90,
            right: 60,
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(248,198,75,.22) 0%,rgba(248,198,75,0) 70%)",
          }}
        />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div
            className="text-pretty text-[28px] leading-[1.16] lg:text-[38px]"
            style={{ fontWeight: 600, letterSpacing: "-.022em" }}
          >
            Neste domingo, ouça sem medo de esquecer.
          </div>
          <div
            className="text-[14px] leading-[1.6] lg:text-[16px] lg:leading-[1.62]"
            style={{ fontWeight: 300, color: "#CFE4F3" }}
          >
            Crie sua conta em menos de um minuto e grave seu primeiro sermão.
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <Link
            href="/sign-in"
            className="lp-cta-yellow inline-flex items-center justify-center rounded-[26px] font-semibold uppercase"
            style={{
              background: YELLOW,
              color: "#5A4409",
              fontSize: 13,
              letterSpacing: ".04em",
              padding: "17px 38px",
              boxShadow: "0 10px 24px rgba(0,0,0,.2)",
            }}
          >
            Começar grátis
          </Link>
          <div
            className="text-center text-[11px] lg:text-[11.5px]"
            style={{ fontWeight: 300, color: "#AFCBE0" }}
          >
            Sem cartão de crédito
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 sm:px-10 sm:py-11 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <Logo size={26} textSize={15} />
        <div
          className="flex flex-wrap gap-5 sm:gap-7"
          style={{ fontSize: 12.5, fontWeight: 300, color: "#9BA6B3" }}
        >
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
        <div style={{ fontSize: 12, fontWeight: 300, color: "#B4BEC9" }}>
          © {new Date().getFullYear()} Scriba
        </div>
      </div>
    </footer>
  );
}

function SectionLabel({
  children,
  color = "#A9B5C2",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color,
      }}
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
      className="relative flex-none scale-[.75] sm:scale-90 lg:scale-100"
      style={{
        width: 390,
        padding: 11,
        background: "#fff",
        borderRadius: 44,
        boxShadow: shadow,
      }}
    >
      <div
        className="relative overflow-hidden bg-white"
        style={{
          borderRadius: 34,
          height: 680,
          maskImage: "linear-gradient(180deg, #000 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 82%, transparent 100%)",
        }}
      >
        {/* status bar */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7"
          style={{ height: 44, fontSize: 12, fontWeight: 600, color: "#3B4A5A" }}
        >
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block"
              style={{ width: 14, height: 8, border: "1.4px solid #3B4A5A", borderRadius: 2 }}
            />
          </div>
        </div>
        {/* notch */}
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{ top: 12, width: 104, height: 26, borderRadius: 16, background: "#0B1220" }}
        />
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
    <div
      className="flex items-center justify-between gap-3 px-5 pb-3 pt-2"
      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex min-w-0 flex-col">
        {subtitle ? (
          <span
            className="truncate"
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#A9B5C2",
            }}
          >
            {subtitle}
          </span>
        ) : null}
        <span
          className="truncate"
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: INK_STRONG }}
        >
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

function LiveDot() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: "rgba(220, 38, 38, .08)" }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: "#DC2626", boxShadow: "0 0 0 4px rgba(220,38,38,.15)" }}
      />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#B91C1C" }}>
        AO VIVO
      </span>
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
            <span className="text-xs font-semibold" style={{ color: "var(--scriba-blue)" }}>
              {group.label}
            </span>
            <span className="h-px flex-1" style={{ background: "var(--scriba-hairline)" }} />
            <span className="text-[11px] font-light" style={{ color: "var(--scriba-ink-mute)" }}>
              {group.items.length}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {group.items.map((s) => (
              <li
                key={s.title}
                className="rounded-3xl border bg-white p-4"
                style={{
                  borderColor: "var(--scriba-hairline-soft)",
                  boxShadow: "0 4px 14px rgba(79,168,240,0.08)",
                }}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="text-pretty text-[15px] font-semibold leading-tight tracking-tight"
                    style={{ color: "var(--scriba-ink-strong)" }}
                  >
                    {s.title}
                  </span>
                  <span
                    className="text-pretty text-[13px] font-light leading-snug"
                    style={{ color: "var(--scriba-ink-soft)" }}
                  >
                    {s.summary}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--scriba-ink)" }}
                    >
                      {s.speaker}
                    </span>
                    <span style={{ color: "var(--scriba-ink-mute)" }}>·</span>
                    <span
                      className="text-[11px] font-light"
                      style={{ color: "var(--scriba-ink-mute)" }}
                    >
                      {s.location}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-3 flex items-center gap-2 border-t pt-2.5"
                  style={{ borderColor: "var(--scriba-hairline)" }}
                >
                  <span
                    className="text-[11px] font-light"
                    style={{ color: "var(--scriba-ink-mute)" }}
                  >
                    {s.date}
                  </span>
                  <span
                    className="size-[3px] rounded-full"
                    style={{ background: "rgba(169,181,196,.6)" }}
                  />
                  <span
                    className="text-[11px] font-light"
                    style={{ color: "var(--scriba-ink-mute)" }}
                  >
                    {s.duration}
                  </span>
                  <div className="flex-1" />
                  <span
                    className="rounded-full px-3.5 py-1.5 text-[11px] font-semibold"
                    style={{
                      background: "var(--scriba-blue-soft)",
                      color: "var(--scriba-blue)",
                    }}
                  >
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
