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
      className="w-full bg-white text-[#33414F] antialiased"
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
      <div
        className="flex items-center justify-center rounded-[9px] font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.5,
          background: BLUE,
          boxShadow: "0 5px 12px rgba(79,168,240,.32)",
        }}
      >
        S
      </div>
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
        <Logo />
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
            href="/sign-up"
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
      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-5 pt-9 pb-2 sm:px-10 lg:grid-cols-[1fr_430px] lg:gap-14 lg:pt-[88px] lg:pb-24">
        <div className="flex flex-col gap-4 lg:gap-6">
          <div
            className="inline-flex items-center gap-2 self-start rounded-[22px] border bg-white px-3.5 py-[7px] pl-[9px]"
            style={{ borderColor: "#E3EEF8", boxShadow: "0 4px 12px rgba(79,168,240,.1)" }}
          >
            <div style={{ width: 20, height: 5, borderRadius: 3, background: YELLOW }} />
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".03em",
                color: INK_SOFT,
              }}
            >
              Grave, entenda e viva o sermão
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
            O Scriba escuta a pregação com você, transforma o que foi dito em resumo, versículos e
            práticas — e devolve tudo aos poucos, ao longo da semana, para que a mensagem realmente
            fique.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/sign-up"
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
              Ver o app por dentro
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
        <div className="-mx-5 flex justify-center sm:mx-0">
          <PhoneFrame
            chrome={
              <PhoneChrome subtitle="Culto de domingo" title="Feed vivo" right={<LiveDot />} />
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
          Na quarta-feira, quase nada resta.{" "}
          <span style={{ color: "#8C98A6" }}>
            Anotações soltas, um versículo esquecido e a sensação de que algo importante passou.
          </span>
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
    body: "Anotar durante a pregação divide sua atenção — você escreve em vez de ouvir.",
  },
  {
    n: 2,
    bg: "#FDF3DD",
    fg: "#C79B2A",
    body: "Uma mensagem ouvida uma única vez raramente vira mudança de vida.",
  },
  {
    n: 3,
    bg: "#EAF0FB",
    fg: "#6E82A8",
    body: "Anos de sermões ficam perdidos: nada é buscável, nada se conecta.",
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
            title="Toque em gravar"
            body="Guarde o celular no bolso e apenas ouça. O Scriba acompanha a pregação e vai montando os cartões em tempo real."
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
            title="Receba o resumo"
            body="Ideia central, pontos principais, versículos citados e aplicações práticas — organizados minutos depois do amém."
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
            title="Viva durante a semana"
            body="O feed devolve a mensagem em doses curtas: relembrar, entender, aprofundar e praticar — um passo por dia."
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
      <div className="grid items-center gap-8 lg:grid-cols-[420px_1fr] lg:gap-16">
        <div className="order-2 -mx-5 flex justify-center sm:mx-0 lg:order-1">
          <PhoneFrame
            chrome={<PhoneChrome subtitle="Resumo · 41 min" title="A sede que só Cristo cura" />}
          >
            <SummaryMock />
          </PhoneFrame>
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2 lg:gap-[34px]">
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
              Cada sermão vira blocos com propósito próprio — e cada bloco tem sua cor, para você
              achar o que procura em segundos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
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
    text: "A frase que sustenta toda a pregação, ancorada no topo.",
    bg: "#EAF4FE",
    fg: "#3E86C4",
    body: "#5E86AC",
  },
  {
    title: "Versículos citados",
    text: "Todo texto lido, com referência e contexto de uso.",
    bg: "#FAEAE5",
    fg: "#A8715C",
    body: "#A08373",
  },
  {
    title: "Aplicações práticas",
    text: "O que fazer na segunda-feira, em passos possíveis.",
    bg: "#E4EFEA",
    fg: "#4E8570",
    body: "#6E8A7E",
  },
  {
    title: "Pontos principais",
    text: "A estrutura da mensagem, na ordem em que foi dita.",
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
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-12 text-white sm:px-10 sm:py-[88px] lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
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
              subtitle="“aquele sermão sobre perdão na família”"
              badge="3 resultados"
            />
            <BiblioCard
              title="Conexões automáticas"
              subtitle="Ansiedade · Confiança · Providência"
              badge="Novo"
            />
          </div>
        </div>
        <div className="-mx-5 flex justify-center sm:mx-0">
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
          quote="“Parei de anotar e comecei a ouvir de verdade. Na quarta-feira o app me devolve exatamente o ponto que eu precisava.”"
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
          quote="“Uso com meu grupo pequeno. Chegamos na reunião falando do mesmo sermão, com as mesmas perguntas.”"
          name="Ana Laura Prado"
          title="Líder de grupo pequeno"
          initials="AL"
          bg="#E4EFEA"
          quoteColor="#2F5A49"
          nameColor="#3F6D5A"
          roleColor="#6E8A7E"
          avatarBg="rgba(255,255,255,.7)"
          avatarFg="#4E8570"
          divider="rgba(78,133,112,.22)"
        />
        <TestimonialCard
          quote="“Sei o que a igreja tem ouvido nos últimos dois anos. Isso mudou como eu planejo a pregação.”"
          name="Pr. João Silva"
          title="Pastor titular"
          initials="JS"
          bg="#FDF3DD"
          quoteColor="#6B5A2A"
          nameColor="#7A6836"
          roleColor="#9C8A55"
          avatarBg="rgba(255,255,255,.7)"
          avatarFg="#C79B2A"
          divider="rgba(199,155,42,.24)"
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
        <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-[22px]">
          <PlanCard
            name="Membro"
            price="Grátis"
            hint="4 sermões por mês"
            features={[
              "Gravação e resumo completo",
              "Feed diário de retomada",
              "Biblioteca pessoal",
            ]}
            cta="Criar conta"
            variant="soft"
            accent="#EAF4FE"
          />
          <PlanCard
            name="Discípulo"
            price="R$ 19"
            priceUnit="/mês"
            hint="Sermões ilimitados"
            features={[
              "Tudo do plano Membro",
              "Conexões entre sermões",
              "Busca por significado",
              "Planos de aprofundamento",
            ]}
            cta="Testar 14 dias grátis"
            variant="primary"
            accent={BLUE}
            badge="Mais escolhido"
          />
          <PlanCard
            name="Igreja"
            price="R$ 249"
            priceUnit="/mês"
            hint="Até 300 membros"
            features={[
              "Biblioteca oficial da igreja",
              "Conteúdo para grupos pequenos",
              "Painel de temas e engajamento",
            ]}
            cta="Falar com o time"
            variant="soft"
            accent="#FDF3DD"
          />
        </div>
      </div>
    </section>
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
  accent,
  badge,
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
}) {
  const isPrimary = variant === "primary";
  return (
    <div
      className="lp-lift-plan relative flex flex-col gap-[22px] rounded-[24px] bg-white p-6 sm:rounded-[26px] sm:p-8"
      style={{
        border: isPrimary ? `1.5px solid ${BLUE}` : "1px solid #EAF2FA",
        boxShadow: isPrimary ? "0 16px 40px rgba(79,168,240,.18)" : undefined,
      }}
    >
      {badge ? (
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
        <div className="text-[12.5px] lg:text-[13px]" style={{ fontWeight: 300, color: INK_MUTE }}>
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
            <div
              className="mt-0.5 flex-none rounded-[5px]"
              style={{
                width: 16,
                height: 16,
                background: isPrimary ? BLUE : accent,
              }}
            />
            {f}
          </div>
        ))}
      </div>
      <Link
        href="/sign-up"
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
            href="/sign-up"
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
    text: "A sede que o mundo oferece nunca termina — só troca de nome.",
  },
  {
    kind: "context",
    label: "Sicar",
    text: "O poço de Jacó era memória viva: aliança, promessa e disputa. Jesus escolhe esse cenário para reabrir uma conversa antiga sobre a fonte certa.",
    source: "Comentário bíblico",
  },
  {
    kind: "speakerCitation",
    text: "O nosso coração está inquieto enquanto não repousa em Ti.",
    author: "Agostinho, citado pelo pregador",
  },
  {
    kind: "suggestedQuote",
    text: "A sede humana só encontra descanso na plenitude de Deus.",
    author: "A. W. Tozer",
    reason: "Reforça o ponto sobre fontes secas.",
  },
  {
    kind: "speakerEcho",
    text: "A cura da sede vem por outra sede — a sede de Deus.",
  },
];

const DEMO_SUMMARY: SummaryPayload = {
  thinking: "",
  title: "A sede que só Cristo cura",
  shortSummary:
    "A verdadeira sede da alma não é fisiológica — é por comunhão com Deus, e nada além dele a sacia.",
  blocks: [
    { type: "h1", text: "A sede que só Cristo cura" },
    {
      type: "paragraph",
      text: "Jesus se aproxima da samaritana num poço fora da cidade — território de cansaço e vergonha. É ali, no meio-dia mais quente, que ele oferece uma água que sacia de outra maneira.",
    },
    {
      type: "highlight",
      text: "A sede que o mundo oferece nunca termina — só troca de nome.",
    },
    { type: "h2", text: "Três fontes falsas" },
    {
      type: "paragraph",
      text: "O pregador identifica os lugares onde tentamos matar essa sede: aprovação social, produtividade constante e o entretenimento que anestesia sem curar.",
    },
    {
      type: "example",
      text: "Ele contou de um ex-atleta que só descobriu a sede real quando as medalhas pararam de bastar.",
    },
    {
      type: "quote",
      text: "O nosso coração está inquieto enquanto não repousa em Ti.",
      author: "Agostinho",
    },
    {
      type: "conclusion",
      text: "Se a sede não passa é porque a fonte está errada. A oferta permanece: água viva, para quem tiver coragem de dizer ‘tenho sede’.",
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
