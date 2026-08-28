import Link from "next/link";
import { redirect } from "next/navigation";
import { Feed } from "@/features/session/components/Feed";
import { SummaryView } from "@/features/session/components/SummaryView";
import type { FeedItem } from "@/lib/domain/feed";
import type { SummaryPayload } from "@/lib/domain/summary";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";

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
      <LandingHeader onLandingPage />
      <Hero />
      <Problem />
      <HowItWorks />
      <Resumo />
      <Biblioteca />
      <Testimonials />
      <Plans />
      <FinalCTA />
      <LandingFooter onLandingPage />
    </div>
  );
}

const HERO_AVATARS = [
  { src: "https://mockmind-api.uifaces.co/content/human/5.jpg" },
  { src: "https://mockmind-api.uifaces.co/content/human/17.jpg" },
  { src: "https://mockmind-api.uifaces.co/content/human/42.jpg" },
  { src: "https://mockmind-api.uifaces.co/content/human/88.jpg" },
] as const;

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#F6FBFF_0%,#FFFFFF_100%)]">
      <div className="pointer-events-none absolute -top-[180px] -right-[140px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-[120px] -left-[160px] hidden h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)] lg:block" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pb-2 pt-9 sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:pb-24 lg:pt-[88px]">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-[22px] border border-[#E3EEF8] bg-white px-3.5 py-[7px] pl-[9px] shadow-[0_4px_12px_rgba(79,168,240,.1)]">
            <div className="h-[5px] w-2.5 rounded-[3px] bg-scriba-yellow" />
            <div className="text-[10.5px] font-semibold tracking-[.03em] text-scriba-ink-soft">
              Ouça, relembre e coloque em prática.
            </div>
          </div>
          <h1 className="text-pretty text-[36px] font-semibold leading-[1.08] tracking-[-.025em] text-scriba-ink-strong lg:text-[60px] lg:leading-[1.06]">
            O sermão não termina quando você sai da igreja.
          </h1>
          <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[17.5px]">
            O Scriba escuta a pregação com você, organiza os principais ensinamentos e ajuda a
            relembrar e colocar em prática ao longo da semana.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/sign-in"
              className="lp-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-scriba-blue py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-white shadow-[0_9px_22px_rgba(79,168,240,.3)]"
            >
              {/** biome-ignore lint/performance/noImgElement: static asset in landing CTA */}
              <img src="/pena-logo-white.svg" alt="" aria-hidden width={16} height={16} />
              Começar grátis
            </Link>
            <a
              href="#recursos"
              className="lp-cta-outline inline-flex items-center justify-center rounded-[26px] border border-auth-btn-border bg-white py-4 px-7 text-[13px] font-medium text-scriba-ink"
            >
              Conhecer o Scriba
            </a>
          </div>
          <div className="flex items-center gap-3.5 pt-1.5 sm:gap-5 sm:pt-3.5">
            <div className="flex">
              {HERO_AVATARS.map((a, i) => (
                // biome-ignore lint/performance/noImgElement: external placeholder avatar (uifaces.co)
                <img
                  key={a.src}
                  src={a.src}
                  alt=""
                  aria-hidden
                  width={34}
                  height={34}
                  className={cn(
                    "size-[31px] rounded-full border-2 border-white object-cover sm:size-[34px]",
                    i > 0 && "-ml-[9px]"
                  )}
                />
              ))}
            </div>
            <div className="text-[11.5px] font-light leading-[1.5] text-scriba-ink-soft sm:text-[12.5px]">
              <span className="font-semibold text-scriba-ink">15 sermões</span> registrados por
              membros do Scriba.
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

const PROBLEM_CLASSES = {
  rose: "bg-scriba-rose text-scriba-rose-accent",
  cream: "bg-scriba-cream text-scriba-cream-accent",
  lilac: "bg-scriba-lilac text-scriba-lilac-accent",
} as const;

const PROBLEMS: { n: number; variant: keyof typeof PROBLEM_CLASSES; body: string }[] = [
  {
    n: 1,
    variant: "rose",
    body: "Anotar durante o sermão divide sua atenção: enquanto você escreve, deixa de acompanhar o que está sendo dito.",
  },
  {
    n: 2,
    variant: "cream",
    body: "Sem revisitar a mensagem, os detalhes desaparecem: uma frase importante, uma referência bíblica, uma aplicação para a semana.",
  },
  {
    n: 3,
    variant: "lilac",
    body: "Com o tempo, fica difícil encontrar o que você ouviu: os sermões se acumulam, mas seus aprendizados não ficam organizados.",
  },
];

function Problem() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 py-11 sm:px-10 sm:py-20 lg:gap-9 lg:pb-24">
      <SectionLabel>O problema</SectionLabel>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <h2 className="text-pretty text-[25px] font-medium leading-[1.32] tracking-[-.016em] text-scriba-ink-strong lg:text-[34px]">
          <span className="text-scriba-ink-mute">
            Você sai da igreja querendo lembrar de tudo.{" "}
          </span>
          Alguns dias depois, muita coisa já se perdeu.
        </h2>
        <div className="flex flex-col gap-3.5 lg:gap-[18px]">
          {PROBLEMS.map((p) => (
            <div key={p.n} className="flex items-start gap-3.5 sm:gap-4">
              <div
                className={cn(
                  "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] text-[13px] font-semibold sm:size-[38px] sm:rounded-[12px]",
                  PROBLEM_CLASSES[p.variant]
                )}
              >
                {p.n}
              </div>
              <div className="pt-1.5 text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft sm:text-[14.5px]">
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-[52px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <SectionLabel color="blue">Como funciona</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.02em] text-scriba-ink-strong lg:text-[42px]">
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
                  <span className="h-2.5 w-[2.5px] rounded-[2px] bg-white" />
                  <span className="h-4.5 w-[2.5px] rounded-[2px] bg-white" />
                  <span className="h-[13px] w-[2.5px] rounded-[2px] bg-white" />
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
                <div className="h-4 w-4 rounded-[5px] border-[2.5px] border-scriba-mint-accent" />
              </div>
            }
          />
          <StepCard
            step="Passo 03"
            title="Continue a reflexão"
            body="Durante a semana, o Scriba ajuda você a relembrar a mensagem, colocá-la em prática e fazer conexões com outros sermões."
            icon={
              <div className="flex size-11 items-center justify-center rounded-full bg-scriba-cream">
                <div className="h-4 w-4 rounded-full border-[2.5px] border-t-transparent border-scriba-cream-accent" />
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

type StepCardProps = {
  step: string;
  title: string;
  body: string;
  icon: React.ReactNode;
};

function StepCard({ step, title, body, icon }: StepCardProps) {
  return (
    <div className="lp-lift flex flex-col gap-3.5 rounded-[24px] border border-[#EAF2FA] bg-white p-6 shadow-[0_8px_26px_rgba(79,168,240,.09)] sm:rounded-[26px] sm:p-8">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-scriba-ink-mute">
          {step}
        </div>
        {icon}
      </div>
      <div className="text-[19px] font-semibold leading-[1.28] tracking-[-.012em] text-scriba-ink sm:text-[21px]">
        {title}
      </div>
      <div className="text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft sm:text-[14px] sm:leading-[1.62]">
        {body}
      </div>
    </div>
  );
}

const TILE_CLASSES = {
  blue: { bg: "bg-scriba-blue-soft", title: "text-scriba-blue-ink", body: "text-scriba-blue-body" },
  rose: { bg: "bg-scriba-rose", title: "text-scriba-rose-accent", body: "text-scriba-rose-body" },
  mint: { bg: "bg-scriba-mint", title: "text-scriba-mint-accent", body: "text-scriba-mint-body" },
  cream: {
    bg: "bg-scriba-cream",
    title: "text-scriba-cream-accent",
    body: "text-scriba-cream-body",
  },
} as const;

const SUMMARY_BLOCKS: { title: string; text: string; variant: keyof typeof TILE_CLASSES }[] = [
  {
    title: "Ideia central",
    text: "O ensinamento que conduz toda a mensagem, destacado logo no início.",
    variant: "blue",
  },
  {
    title: "Versículos citados",
    text: "As passagens mencionadas pelo pregador, reunidas com suas referências.",
    variant: "rose",
  },
  {
    title: "Aplicações práticas",
    text: "Caminhos possíveis para levar o que você ouviu para a vida cotidiana.",
    variant: "mint",
  },
  {
    title: "Pontos principais",
    text: "O desenvolvimento do sermão organizado de forma clara e fácil de consultar.",
    variant: "cream",
  },
];

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
            <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
              Não é transcrição. É a mensagem, organizada.
            </h2>
            <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[16px] lg:leading-[1.65]">
              Ao final do sermão, o Scriba transforma tudo o que foi dito em um resumo claro, para
              você entender, encontrar e relembrar o que realmente importa.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
            {SUMMARY_BLOCKS.map((b) => {
              const cls = TILE_CLASSES[b.variant];
              return (
                <div
                  key={b.title}
                  className={cn(
                    "lp-tile flex flex-col gap-1.5 rounded-[18px] p-4 sm:rounded-[20px] sm:p-5",
                    cls.bg
                  )}
                >
                  <div className={cn("text-[11.5px] font-semibold sm:text-[12px]", cls.title)}>
                    {b.title}
                  </div>
                  <div
                    className={cn(
                      "text-[12px] font-light leading-[1.5] sm:text-[13px] sm:leading-[1.55]",
                      cls.body
                    )}
                  >
                    {b.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Biblioteca() {
  return (
    <section className="relative overflow-hidden bg-scriba-blue">
      <div className="pointer-events-none absolute -top-[140px] -left-[100px] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-8 px-5 py-12 text-white sm:px-10 sm:py-[88px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionLabel color="yellow-light">Sua biblioteca</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[40px]">
            Anos de pregação, finalmente buscáveis.
          </h2>
          <p className="max-w-[500px] text-pretty text-[14.5px] font-light leading-[1.62] text-[#E2F1FF] lg:text-[16px] lg:leading-[1.65]">
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
            dark
            chrome={
              <PhoneChrome
                subtitle="Biblioteca"
                title="Suas gravações"
                right={
                  <span className="rounded-full bg-scriba-blue-soft px-2.5 py-1 text-[10px] font-semibold text-scriba-blue">
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

type BiblioCardProps = {
  title: string;
  subtitle: string;
  badge: string;
};

function BiblioCard({ title, subtitle, badge }: BiblioCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-white/[.16] p-4 px-[17px] sm:px-[18px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] font-semibold sm:text-[13.5px]">{title}</div>
        <div className="text-[11.5px] font-light text-[#E2F1FF] sm:text-[12px]">{subtitle}</div>
      </div>
      <div className="flex-none whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.04em] text-scriba-yellow-light">
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
          avatarSrc="https://mockmind-api.uifaces.co/content/human/12.jpg"
        />
        <TestimonialCard
          quote={`"Uso com meu grupo pequeno. Chegamos na reunião falando do mesmo sermão, com as mesmas perguntas."`}
          name="Ana Laura Prado"
          title="Líder de grupo pequeno"
          avatarSrc="https://mockmind-api.uifaces.co/content/human/22.jpg"
        />
        <TestimonialCard
          quote={`"Sei o que a igreja tem ouvido nos últimos dois anos. Isso mudou como eu planejo a pregação."`}
          name="Pr. João Silva"
          title="Pastor titular"
          avatarSrc="https://mockmind-api.uifaces.co/content/human/45.jpg"
        />
      </div>
    </section>
  );
}

type TestimonialCardProps = {
  quote: string;
  name: string;
  title: string;
  avatarSrc: string;
};

function TestimonialCard({ quote, name, title, avatarSrc }: TestimonialCardProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[24px] border border-[#EAF2FA] bg-white p-6 shadow-[0_8px_24px_rgba(79,168,240,.08)] sm:rounded-[26px] sm:p-8">
      <div className="text-pretty text-[15px] font-normal leading-[1.55] text-[#3D4C5B] sm:text-[16.5px]">
        {quote}
      </div>
      <div className="mt-auto flex items-center gap-2.5 border-t border-[#EEF2F6] pt-[13px] sm:gap-[11px] sm:pt-[15px]">
        {/** biome-ignore lint/performance/noImgElement: external placeholder avatar (uifaces.co) */}
        <img
          src={avatarSrc}
          alt=""
          aria-hidden
          width={34}
          height={34}
          className="size-8 flex-none rounded-full object-cover sm:size-[34px]"
        />
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
    <section id="planos" className="border-t border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-10 sm:py-[92px] lg:gap-12">
        <div className="flex flex-col gap-3 lg:items-center lg:text-center">
          <SectionLabel color="blue">Planos</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[42px] lg:leading-[1.14]">
            Comece grátis. Cresça quando fizer sentido.
          </h2>
          <p className="max-w-[520px] text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft lg:text-[15.5px]">
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
              "Gerar estudos",
            ]}
            cta="Escolher Pessoal"
            variant="soft"
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
              "Gerar estudos",
            ]}
            cta="Começar grátis"
            variant="primary"
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
              "Gerar estudos",
            ]}
            cta="Escolher Estudioso"
            variant="soft"
            comingSoon
          />
        </div>
      </div>
    </section>
  );
}

function CoinHex() {
  return (
    <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-[#FFF3C4]">
      <span className="coin-hex block h-[12.5px] w-[11px] bg-scriba-yellow" />
    </span>
  );
}

type PlanCardProps = {
  name: string;
  price: string;
  priceUnit?: string;
  hint: string;
  features: string[];
  cta: string;
  variant: "primary" | "soft";
  badge?: string;
  comingSoon?: boolean;
};

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
}: PlanCardProps) {
  const isPrimary = variant === "primary" && !comingSoon;
  return (
    <div
      className={cn(
        "relative flex flex-col gap-[22px] rounded-[24px] bg-white p-6 sm:rounded-[26px] sm:p-8",
        isPrimary
          ? "border-[1.5px] border-scriba-blue shadow-[0_16px_40px_rgba(79,168,240,.18)]"
          : "border border-[#EAF2FA]",
        !comingSoon && "lp-lift-plan",
        comingSoon && "pointer-events-none grayscale opacity-45"
      )}
    >
      {comingSoon ? (
        <div className="absolute -top-[13px] left-6 rounded-[20px] bg-[#E8EEF4] px-[14px] py-[6px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#637080] sm:left-7">
          Em breve
        </div>
      ) : badge ? (
        <div className="absolute -top-[13px] left-6 rounded-[20px] bg-scriba-yellow px-[14px] py-[6px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#5A4409] sm:left-7">
          {badge}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "text-[13px] font-semibold tracking-[.03em]",
            isPrimary ? "text-scriba-blue" : "text-scriba-ink-soft"
          )}
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
          <CoinHex />
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
              className={cn("mt-0.5 flex-none", isPrimary ? "text-scriba-blue" : "text-[#7A9BB5]")}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8.5L6.5 12L13 5"
                stroke="currentColor"
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
        <div className="inline-flex cursor-not-allowed items-center justify-center rounded-[24px] bg-[#F0F4F8] p-[15px] text-[12px] font-semibold uppercase tracking-[.04em] text-[#9AABB8]">
          Em breve
        </div>
      ) : (
        <Link
          href="/sign-in"
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[24px] p-[15px] text-[12px] font-semibold uppercase tracking-[.04em]",
            isPrimary
              ? "lp-cta bg-scriba-blue text-white shadow-[0_8px_20px_rgba(79,168,240,.3)]"
              : "lp-cta-soft bg-scriba-btn-muted text-scriba-ink"
          )}
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
        <div className="pointer-events-none absolute -top-[90px] right-[60px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.22)_0%,rgba(248,198,75,0)_70%)]" />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div className="text-pretty text-[28px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[38px]">
            Neste domingo, ouça sem medo de esquecer.
          </div>
          <div className="text-[14px] font-light leading-[1.6] text-[#CFE4F3] lg:text-[16px] lg:leading-[1.62]">
            Crie sua conta em menos de um minuto e grave seu primeiro sermão.
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <Link
            href="/sign-in"
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-scriba-yellow py-[17px] px-[38px] text-[13px] font-semibold uppercase tracking-[.04em] text-[#5A4409] shadow-[0_10px_24px_rgba(0,0,0,.2)]"
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

type SectionLabelProps = {
  children: React.ReactNode;
  color?: "blue" | "mute" | "yellow-light";
};

function SectionLabel({ children, color = "mute" }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[.12em]",
        color === "blue" && "text-scriba-blue",
        color === "mute" && "text-scriba-ink-mute",
        color === "yellow-light" && "text-scriba-yellow-light"
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Phone mockups ---------- */

type PhoneFrameProps = {
  children: React.ReactNode;
  dark?: boolean;
  chrome?: React.ReactNode;
};

function PhoneFrame({ children, dark = false, chrome }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative w-[390px] flex-none scale-[.75] rounded-[44px] bg-white p-[11px] sm:scale-90 lg:scale-100",
        dark ? "phone-frame-dark" : "phone-frame"
      )}
    >
      <div className="phone-mask relative h-[680px] overflow-hidden rounded-[34px] bg-white">
        <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between px-7 text-[12px] font-semibold text-[#3B4A5A]">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-[14px] rounded-[2px] border-[1.4px] border-[#3B4A5A]"
            />
          </div>
        </div>
        <div className="absolute left-1/2 top-[12px] z-10 h-6.5 w-26 -translate-x-1/2 rounded-[16px] bg-[#0B1220]" />
        {chrome ? (
          <div className="absolute inset-x-0 top-11 z-[5] bg-white/95 backdrop-blur">{chrome}</div>
        ) : null}
        <div className={chrome ? "pt-[108px]" : "pt-[52px]"}>{children}</div>
      </div>
    </div>
  );
}

type PhoneChromeProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

function PhoneChrome({ title, subtitle, right }: PhoneChromeProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-scriba-hairline-soft px-5 pb-3 pt-2">
      <div className="flex min-w-0 flex-col">
        {subtitle ? (
          <span className="truncate text-[10px] font-semibold uppercase tracking-[.12em] text-scriba-ink-mute">
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
    { type: "h1", text: "A água viva para corações sedentos" },
    {
      type: "paragraph",
      text: "À beira do poço de Jacó, Jesus inicia uma conversa improvável com uma mulher samaritana. Ao pedir água, ele atravessa barreiras religiosas, étnicas e sociais.",
    },
    {
      type: "highlight",
      text: "Jesus não oferece apenas água para a sede. Ele revela a sede que aquela mulher ainda não sabia nomear.",
    },
    { type: "h2", text: "As cisternas que não podem nos saciar" },
    {
      type: "paragraph",
      text: "Assim como a samaritana voltaria ao poço depois de beber, também retornamos às mesmas fontes em busca de satisfação: aprovação, relacionamentos, conquistas e conforto. Elas aliviam por um momento, mas não alcançam a sede mais profunda do coração.",
    },
    {
      type: "example",
      text: "É possível conquistar aquilo que desejávamos e, pouco tempo depois, sentir novamente o mesmo vazio. O problema não está apenas no que buscamos, mas no que esperamos que essas coisas façam por nós.",
    },
    { type: "h2", text: "Conhecidos por inteiro, amados por completo" },
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
    <div className="flex flex-col gap-4 px-4 pb-8 pt-3">
      <Feed items={DEMO_FEED_ITEMS} running hasTranscript suggesting />
    </div>
  );
}

function SummaryMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-3">
      <SummaryView summary={DEMO_SUMMARY} hasTranscript running={false} />
    </div>
  );
}

function LibraryMock() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-3">
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
                  <span className="size-[3px] rounded-full bg-scriba-hairline" />
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
