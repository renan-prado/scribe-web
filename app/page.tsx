import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { formatBrl, formatCoins, PLANS, TOPUP } from "@/lib/billing/plans";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import avatar1 from "@/shared/assets/avatars/avatar-1.webp";
import avatar2 from "@/shared/assets/avatars/avatar-2.webp";
import avatar3 from "@/shared/assets/avatars/avatar-3.webp";
import avatar4 from "@/shared/assets/avatars/avatar-4.webp";
import avatar5 from "@/shared/assets/avatars/avatar-5.webp";
import avatar6 from "@/shared/assets/avatars/avatar-6.webp";
import avatar7 from "@/shared/assets/avatars/avatar-7.webp";
import { ScribaMark } from "@/shared/brand";
import { LandingFooter, LandingHeader } from "@/shared/components/LandingChrome";
import { LandingJsonLd } from "@/shared/components/LandingJsonLd";
import { LandingFeedMock, LandingSummaryMock } from "@/shared/components/LandingMocks";
import { FAQ_ITEMS } from "@/shared/content/landing-faq";

export const metadata = {
  // `absolute` porque o template do layout é "%s": sem ele o título da LP
  // seria o mesmo da rota, e é aqui que o valor do Google é decidido.
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * A landing page é ESTÁTICA de propósito — nada aqui pode ler cookie, sessão
 * ou header, ou o Next volta a marcá-la como dinâmica.
 *
 * Antes ela chamava `supabase.auth.getUser()` para mandar quem já está logado
 * para `/feed`. Bastava isso para tornar a rota dinâmica, e o efeito ia longe:
 * cada visita anônima respondia `Cache-Control: private, no-store` com
 * `X-Vercel-Cache: MISS`, ou seja, HTML remontado do zero na origem, com duas
 * idas ao Supabase — uma no `proxy.ts` e outra aqui — antes do primeiro byte.
 * Numa página cujo conteúdo é o MESMO para todo visitante deslogado. O
 * `no-store` ainda derrubava o bfcache (voltar para a LP recarregava tudo).
 *
 * O redirect de quem está logado mudou para o `proxy.ts`, que já tinha o
 * usuário em mãos: mesmo comportamento, sem custar a estaticidade da página.
 */
export default function LandingPage() {
  return (
    <div className="w-full overflow-x-clip bg-background text-scriba-ink-strong antialiased">
      <LandingJsonLd />
      <LandingHeader onLandingPage />
      {/* O `<main>` é o landmark que faltava — o resto do app já tem um, só a
          LP não tinha. Sem ele, quem navega por leitor de tela não consegue
          pular o header e cair direto no conteúdo. Não leva classe nenhuma: o
          hero sobe atrás do header por margem negativa, e qualquer coisa que
          criasse contexto de formatação novo aqui (overflow, display) quebraria
          esse encaixe. */}
      <main>
        <Hero />
        <WhatIsScriba />
        <Problem />
        <HowItWorks />
        <Resumo />
        <Biblioteca />
        <Testimonials />
        <Plans />
        <Faq />
        <FinalCTA />
      </main>
      <LandingFooter onLandingPage />
    </div>
  );
}

/**
 * Avatares servidos do nosso próprio bundle, não de `mockmind-api.uifaces.co`.
 *
 * O externo custava 724 KB: sete JPEG de 1024×1024 para desenhar círculos de
 * 34 px. Pior que o peso era a prioridade — o React 19 emite
 * `<link rel="preload" as="image">` para todo `<img>` renderizado no servidor,
 * então os 724 KB disputavam a banda inicial COM o CSS, antes do primeiro
 * paint. Era a maior linha do relatório do Lighthouse ("723 KiB").
 *
 * Reduzidos a 136 px (4× o tamanho de tela) em WebP, os sete somam 20 KB, e o
 * `next/image` ainda gera as variantes do srcset a partir daí. O import
 * estático também dá `width`/`height` de graça — sem reserva de espaço, sete
 * avatares chegando tarde empurrariam o texto ao lado e viraria CLS.
 */
const HERO_AVATARS: readonly StaticImageData[] = [avatar1, avatar2, avatar3, avatar4];

/**
 * O hero sobe por trás do header (margem negativa = `--lp-header-h`) e devolve
 * o mesmo valor no padding do conteúdo, então o gradiente corre sob o header
 * translúcido sem deslocar nada do que está escrito.
 */
function Hero() {
  return (
    <section className="relative mt-[calc(var(--lp-header-h)*-1)] overflow-hidden bg-[image:var(--lp-hero)]">
      <div className="pointer-events-none absolute -top-[180px] -right-[140px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-[120px] -left-[160px] hidden h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)] lg:block" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pb-2 pt-[calc(var(--lp-header-h)+2.25rem)] sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:pb-24 lg:pt-[calc(var(--lp-header-h)+5.5rem)]">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-[22px] border border-scriba-hairline bg-scriba-paper px-3.5 py-[7px] pl-[9px] shadow-[0_4px_12px_rgba(79,168,240,.1)]">
            <div className="h-[5px] w-2.5 rounded-[3px] bg-scriba-yellow" />
            <div className="text-[10.5px] font-semibold tracking-[.03em] text-scriba-ink-soft">
              Ouça, relembre e coloque em prática.
            </div>
          </div>
          <h1 className="text-pretty text-[36px] font-semibold leading-[1.08] tracking-[-.025em] text-scriba-ink-strong lg:text-[60px] lg:leading-[1.06]">
            O sermão não termina quando você sai da igreja.
          </h1>
          <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[17.5px]">
            O Scriba escuta a pregação com você, transcreve o que é dito, organiza os principais
            ensinamentos e ajuda a relembrar e colocar em prática ao longo da semana.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/sign-in"
              className="scriba-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-[image:var(--scriba-cta)] py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink shadow-[0_9px_22px_var(--scriba-cta-shadow)]"
            >
              <ScribaMark size={20} />
              Começar grátis
            </Link>
            <a
              href="#recursos"
              className="lp-cta-outline inline-flex items-center justify-center rounded-[26px] border border-auth-btn-border bg-scriba-paper py-4 px-7 text-[13px] font-medium text-scriba-ink"
            >
              Conhecer o Scriba
            </a>
          </div>
          {/* Avatares nunca encolhem (flex-none) e o texto ganha min-w-0 + basis
              própria, então em telas estreitas ele quebra para a linha de baixo
              em vez de espremer as fotos. */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-1.5 sm:gap-x-5 sm:pt-3.5">
            <div className="flex flex-none">
              {HERO_AVATARS.map((a, i) => (
                <Image
                  key={a.src}
                  src={a}
                  alt=""
                  aria-hidden
                  width={34}
                  height={34}
                  // Estes quatro estão acima da dobra e o `next/image` adia por
                  // padrão — o Next chega a avisar no console que um deles vira
                  // o elemento de LCP. `eager` (e não `priority`) porque só
                  // queremos tirar o adiamento: `priority` devolveria o
                  // `<link rel="preload">` que motivou toda esta mudança. São
                  // 10 KB somados, não vale adiar. Os dos depoimentos, bem
                  // abaixo da dobra, seguem `lazy`.
                  loading="eager"
                  className={cn(
                    "size-[31px] flex-none rounded-full border-2 border-scriba-paper object-cover sm:size-[34px]",
                    i > 0 && "-ml-[9px]"
                  )}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1 basis-[200px] text-pretty text-[11.5px] font-light leading-[1.5] text-scriba-ink-soft sm:text-[12.5px]">
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
            <LandingFeedMock />
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

/**
 * A cópia original vinha como um parágrafo único com dois pontos no meio; o
 * corte vira manchete + desdobramento, que é o que a trilha abaixo desenha.
 */
const PROBLEMS: {
  n: number;
  variant: keyof typeof PROBLEM_CLASSES;
  title: string;
  body: string;
}[] = [
  {
    n: 1,
    variant: "rose",
    title: "Anotar durante o sermão divide sua atenção",
    body: "Enquanto você escreve, deixa de acompanhar o que está sendo dito.",
  },
  {
    n: 2,
    variant: "cream",
    title: "Sem revisitar a mensagem, os detalhes desaparecem",
    body: "Uma frase importante, uma referência bíblica, uma aplicação para a semana.",
  },
  {
    n: 3,
    variant: "lilac",
    title: "Com o tempo, fica difícil encontrar o que você ouviu",
    body: "Os sermões se acumulam, mas seus aprendizados não ficam organizados.",
  },
];

/**
 * Definição em texto corrido do produto.
 *
 * A LP inteira era escrita por evocação — "o sermão não termina quando você
 * sai da igreja" — e em nenhum ponto dizia o que o Scriba É. Isso funciona
 * para quem já chegou pelo boca a boca e falha para quem chega pela busca:
 * sem uma frase declarativa, nem o leitor nem o buscador conseguem
 * classificar o produto. Esta seção responde às quatro perguntas nessa ordem:
 * o que é, para quem, o que faz, que problema resolve.
 *
 * Marcação semântica de propósito: `<dl>` com termo e definição diz a
 * estrutura, coisa que quatro `<div>` empilhadas não fazem.
 */
const DEFINITIONS: { term: string; detail: string }[] = [
  {
    term: "Para quem é",
    detail:
      "Membros que querem lembrar do domingo durante a semana, líderes de grupo pequeno, estudantes de teologia e quem acompanha pregações e quer revisá-las depois.",
  },
  {
    term: "O que ele faz",
    detail:
      "Transcreve a fala em tempo real, reconhece os versículos citados, guarda as frases marcantes e escreve o resumo assim que a pregação termina.",
  },
  {
    term: "Onde funciona",
    detail:
      "No navegador do celular ou do computador, sem instalar nada: culto, estudo bíblico, célula, congresso ou aula de seminário.",
  },
  {
    term: "Que problema resolve",
    detail:
      "Anotar tira você da mensagem; não anotar apaga a mensagem alguns dias depois. O Scriba anota no seu lugar e devolve organizado.",
  },
];

function WhatIsScriba() {
  return (
    <section id="o-que-e" className="border-y border-scriba-hairline-soft bg-scriba-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-10 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <SectionLabel color="blue">O que é o Scriba</SectionLabel>
          <h2 className="text-pretty text-[27px] font-semibold leading-[1.18] tracking-[-.02em] text-scriba-ink-strong lg:text-[38px]">
            Um aplicativo que ouve a pregação e escreve por você.
          </h2>
          <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.65] text-scriba-ink-soft lg:text-[16px]">
            O Scriba transcreve sermões, estudos bíblicos e mensagens da igreja enquanto eles
            acontecem. Enquanto o pregador fala, ele reconhece as passagens lidas e separa o que foi
            dito de mais importante. Quando a pregação termina, o resumo já está pronto: ideia
            central, pontos principais, versículos citados e aplicações para a semana.
          </p>
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
              <dt className="flex-none text-[13px] font-semibold leading-[1.5] text-scriba-ink-strong sm:w-[168px] sm:text-[13.5px]">
                {d.term}
              </dt>
              <dd className="min-w-0 text-pretty text-[13.5px] font-light leading-[1.62] text-scriba-ink-soft sm:text-[14.5px]">
                {d.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * As perguntas vêm de `src/shared/content/landing-faq.ts`, o mesmo módulo que
 * alimenta o JSON-LD `FAQPage`. Um texto aqui divergente do dado estruturado
 * derruba o rich result da página inteira — por isso a fonte é única.
 */
function Faq() {
  return (
    <section
      id="perguntas"
      className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-12 sm:px-10 sm:py-24 lg:gap-12"
    >
      <div className="flex flex-col gap-3 lg:items-center lg:text-center">
        <SectionLabel color="blue">Perguntas frequentes</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que costumam perguntar antes do primeiro domingo.
        </h2>
      </div>
      <div className="grid gap-x-[52px] gap-y-0 lg:grid-cols-2">
        {FAQ_ITEMS.map((item) => (
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
        <ol className="flex flex-col">
          {PROBLEMS.map((p, i) => {
            const last = i === PROBLEMS.length - 1;
            return (
              <li key={p.n} className={cn("flex gap-4 sm:gap-5", !last && "pb-6 sm:pb-7")}>
                {/* Trilho: marcador + linha que se dissolve até o próximo item */}
                <div className="flex flex-none flex-col items-center">
                  <span
                    className={cn(
                      "flex size-9 flex-none items-center justify-center rounded-[13px] text-[13px] font-semibold sm:size-10",
                      PROBLEM_CLASSES[p.variant]
                    )}
                  >
                    {p.n}
                  </span>
                  {last ? null : (
                    <span
                      aria-hidden
                      className="mt-2 w-px flex-1 bg-[linear-gradient(180deg,var(--scriba-hairline),transparent)]"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 pt-1 sm:pt-1.5">
                  <h3 className="text-pretty text-[15px] font-semibold leading-[1.35] tracking-[-.01em] text-scriba-ink-strong sm:text-[16.5px]">
                    {p.title}
                  </h3>
                  <p className="text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft sm:text-[14.5px]">
                    {p.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
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
                  <span className="h-2.5 w-[2.5px] rounded-[2px] bg-scriba-paper" />
                  <span className="h-4.5 w-[2.5px] rounded-[2px] bg-scriba-paper" />
                  <span className="h-[13px] w-[2.5px] rounded-[2px] bg-scriba-paper" />
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
    <div className="lp-lift flex flex-col gap-3.5 rounded-[24px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_8px_26px_rgba(79,168,240,.09)] sm:rounded-[26px] sm:p-8">
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

/** Chip tinting for the summary tiles — one swatch per block of the resumo. */
const TILE_CLASSES = {
  blue: "bg-scriba-blue-soft text-scriba-blue-ink",
  rose: "bg-scriba-rose text-scriba-rose-accent",
  mint: "bg-scriba-mint text-scriba-mint-accent",
  cream: "bg-scriba-cream text-scriba-cream-accent",
} as const;

const TILE_ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const SUMMARY_BLOCKS: {
  title: string;
  text: string;
  variant: keyof typeof TILE_CLASSES;
  icon: React.ReactNode;
}[] = [
  {
    title: "Ideia central",
    text: "O ensinamento que conduz toda a mensagem, destacado logo no início.",
    variant: "blue",
    icon: (
      <svg {...TILE_ICON_PROPS} role="presentation">
        <circle cx="8" cy="8" r="5.6" />
        <circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Versículos citados",
    text: "As passagens mencionadas pelo pregador, reunidas com suas referências.",
    variant: "rose",
    icon: (
      <svg {...TILE_ICON_PROPS} role="presentation">
        <path d="M8 4.6v8.2" />
        <path d="M8 4.6C6.7 3.5 5.1 3.2 3.4 3.3v8.2c1.7-.1 3.3.2 4.6 1.3" />
        <path d="M8 4.6c1.3-1.1 2.9-1.4 4.6-1.3v8.2c-1.7-.1-3.3.2-4.6 1.3" />
      </svg>
    ),
  },
  {
    title: "Aplicações práticas",
    text: "Caminhos possíveis para levar o que você ouviu para a vida cotidiana.",
    variant: "mint",
    icon: (
      <svg {...TILE_ICON_PROPS} role="presentation">
        <circle cx="8" cy="8" r="5.6" />
        <path d="M5.6 8.2 7.3 9.9l3.2-3.6" />
      </svg>
    ),
  },
  {
    title: "Pontos principais",
    text: "O desenvolvimento do sermão organizado de forma clara e fácil de consultar.",
    variant: "cream",
    icon: (
      <svg {...TILE_ICON_PROPS} role="presentation">
        <path d="M6.4 4.6h6.2M6.4 8h6.2M6.4 11.4h4" />
        <path d="M3.4 4.6h.01M3.4 8h.01M3.4 11.4h.01" strokeWidth={2.2} />
      </svg>
    ),
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
            <LandingSummaryMock />
          </PhoneFrame>
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:gap-[34px]">
          <div className="flex flex-col gap-3">
            <SectionLabel color="blue">O resumo</SectionLabel>
            <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
              Mais que transcrição: a mensagem, organizada.
            </h2>
            <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[16px] lg:leading-[1.65]">
              Ao final do sermão, o Scriba transforma tudo o que foi dito em um resumo claro, para
              você entender, encontrar e relembrar o que realmente importa.
            </p>
          </div>
          {/* Cartões de papel com um chip colorido por bloco — a cor vira
              acento e não fundo, o que mantém a leitura calma e funciona igual
              nos dois temas. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
            {SUMMARY_BLOCKS.map((b) => (
              <div
                key={b.title}
                className="lp-lift flex flex-col gap-2.5 rounded-[20px] border border-scriba-hairline bg-scriba-paper p-4 shadow-[0_4px_16px_rgba(79,168,240,.06)] sm:p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 flex-none items-center justify-center rounded-[10px]",
                      TILE_CLASSES[b.variant]
                    )}
                  >
                    {b.icon}
                  </span>
                  <span className="text-[13px] font-semibold tracking-[-.005em] text-scriba-ink-strong sm:text-[13.5px]">
                    {b.title}
                  </span>
                </div>
                <p className="text-pretty text-[12.5px] font-light leading-[1.55] text-scriba-ink-soft sm:text-[13px]">
                  {b.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Biblioteca() {
  return (
    <section className="relative overflow-hidden bg-[image:var(--lp-band)]">
      <div className="pointer-events-none absolute -top-[140px] -left-[100px] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-8 px-5 py-12 text-white sm:px-10 sm:py-[88px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionLabel color="yellow-light">Sua biblioteca</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[40px]">
            Anos de pregação, finalmente buscáveis.
          </h2>
          <p className="max-w-[500px] text-pretty text-[14.5px] font-light leading-[1.62] text-lp-band-ink lg:text-[16px] lg:leading-[1.65]">
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
                  <span className="rounded-full bg-scriba-blue-soft px-2.5 py-1 text-[10px] font-semibold text-scriba-blue-ink">
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
    // O véu era `bg-white/[.16]`, que CLAREAVA a banda — e o card é justamente
    // onde ficam os textos menores da seção, então ele piorava o contraste
    // exatamente onde a régua é mais dura. Escurecer em vez de clarear inverte
    // isso: o cartão continua se destacando do fundo, agora para baixo.
    //   título 7,26 · subtítulo 6,31 · badge 5,59
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-black/[.14] p-4 px-[17px] sm:px-[18px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] font-semibold sm:text-[13.5px]">{title}</div>
        <div className="text-[11.5px] font-light text-lp-band-ink sm:text-[12px]">{subtitle}</div>
      </div>
      <div className="flex-none whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.04em] text-scriba-yellow-light">
        {badge}
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-11 sm:px-10 sm:py-24 lg:gap-10">
      <div className="flex flex-col gap-3 lg:items-center lg:text-center">
        <SectionLabel color="blue">Depoimentos</SectionLabel>
        <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[40px]">
          O que dizem quem já ouve com o Scriba.
        </h2>
        <p className="max-w-[520px] text-pretty text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft lg:text-[15.5px]">
          Membros, líderes de grupo e pastores contam o que mudou depois do primeiro domingo.
        </p>
      </div>
      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-[22px]">
        <TestimonialCard
          quote={`"Parei de anotar e comecei a ouvir de verdade. Na quarta-feira o app me devolve exatamente o ponto que eu precisava."`}
          name="Mateus Ribeiro"
          title="Membro · Igreja Batista Central"
          avatarSrc={avatar5}
        />
        <TestimonialCard
          quote={`"Uso com meu grupo pequeno. Chegamos na reunião falando do mesmo sermão, com as mesmas perguntas."`}
          name="Ana Laura Prado"
          title="Líder de grupo pequeno"
          avatarSrc={avatar6}
        />
        <TestimonialCard
          quote={`"Sei o que a igreja tem ouvido nos últimos dois anos. Isso mudou como eu planejo a pregação."`}
          name="Pr. João Silva"
          title="Pastor titular"
          avatarSrc={avatar7}
        />
      </div>
    </section>
  );
}

type TestimonialCardProps = {
  quote: string;
  name: string;
  title: string;
  avatarSrc: StaticImageData;
};

function TestimonialCard({ quote, name, title, avatarSrc }: TestimonialCardProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[24px] border border-scriba-hairline bg-scriba-paper p-6 shadow-[0_8px_24px_rgba(79,168,240,.08)] sm:rounded-[26px] sm:p-8">
      <div className="text-pretty text-[15px] font-normal leading-[1.55] text-scriba-ink sm:text-[16.5px]">
        {quote}
      </div>
      <div className="mt-auto flex items-center gap-2.5 border-t border-scriba-hairline pt-[13px] sm:gap-[11px] sm:pt-[15px]">
        <Image
          src={avatarSrc}
          alt=""
          aria-hidden
          width={34}
          height={34}
          loading="lazy"
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

/**
 * Capacidades do produto — iguais em todos os planos; o que muda entre eles é
 * quantos créditos vêm por mês. Nome, preço e créditos NÃO moram aqui: saem de
 * `lib/billing/plans.ts`, o mesmo catálogo que o diálogo de compra e o
 * /profile leem. Antes disso a LP tinha números próprios, e eles já haviam
 * divergido do real (anunciava 2.000/5.000/100 créditos contra 1.000/2.500/50).
 * Preço de tela errado é promessa quebrada na hora do checkout.
 */
/**
 * O que cada plano entrega. Copy local de propósito — descreve CAPACIDADES, e
 * não valores; nome, preço e créditos vêm de `lib/billing/plans.ts`, o mesmo
 * catálogo do diálogo de compra (ver `app/AGENTS.md`).
 *
 * ⚠️ A lista era uma só para os três planos, e passou a mentir no dia em que o
 * estudo virou exclusivo de plano pago: o card do Gratuito prometia "Gerar
 * estudos", e o botão respondia 403. **Uma linha aqui é uma promessa que
 * `lib/entitlements/features.ts` tem de cumprir** — ao mexer numa, confira a
 * outra.
 */
const FREE_FEATURES = [
  "Sermão ao vivo",
  "Resumo organizado",
  "Referências bíblicas",
  "Destaques e principais ideias",
  "Biblioteca de sermões",
];

// O estudo é o que separa um plano pago do gratuito — daí ele fechar a lista
// dos dois pagos, na posição de maior peso visual.
const PAID_FEATURES = [...FREE_FEATURES, "Modo estudo liberado"];

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
        {/* Sem `items-start`: os cards precisam ESTICAR até a altura do mais alto.
            O Gratuito tem uma vantagem a menos que os pagos, e com o alinhamento
            ao topo ele ficava visivelmente menor — o que lê como plano
            inacabado, não como plano mais simples. */}
        <div className="grid gap-4 [&>*:nth-child(2)]:order-first lg:grid-cols-3 lg:gap-[22px] lg:[&>*:nth-child(2)]:order-none">
          <PlanCard
            name={PLANS.pessoal.name}
            price={formatBrl(PLANS.pessoal.priceCents)}
            priceUnit="/mês"
            hint={`${formatCoins(PLANS.pessoal.coins)} créditos por mês`}
            features={PAID_FEATURES}
            highlightLast
            cta={`Assinar ${PLANS.pessoal.name}`}
            href="/sign-in?next=%2Fbilling%2Fassinar%3Fplan%3Dpessoal"
            variant="soft"
          />
          <PlanCard
            name={PLANS.free.name}
            price="Grátis"
            hint={`${formatCoins(PLANS.free.coins)} créditos para conhecer o Scriba`}
            features={FREE_FEATURES}
            cta="Começar grátis"
            href="/sign-in"
            variant="primary"
            badge="Sem cartão"
          />
          <PlanCard
            name={PLANS.estudioso.name}
            price={formatBrl(PLANS.estudioso.priceCents)}
            priceUnit="/mês"
            hint={`${formatCoins(PLANS.estudioso.coins)} créditos por mês`}
            features={PAID_FEATURES}
            highlightLast
            cta={`Assinar ${PLANS.estudioso.name}`}
            href="/sign-in?next=%2Fbilling%2Fassinar%3Fplan%3Destudioso"
            variant="soft"
          />
        </div>
        <p className="text-center text-[12.5px] font-light leading-[1.6] text-scriba-ink-mute lg:text-[13px]">
          Precisou de mais no meio do mês? Compre {formatCoins(TOPUP.coins)} créditos avulsos por{" "}
          {formatBrl(TOPUP.priceCents)}, quantas vezes quiser — sem assinatura, e eles não expiram.
        </p>
      </div>
    </section>
  );
}

function CoinHex() {
  return (
    <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-scriba-gold-soft">
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
  /** Destino do CTA. Nos planos pagos carrega a intenção via `?next=`, para
   * que a escolha sobreviva ao login e o usuário caia direto no Checkout. */
  href: string;
  variant: "primary" | "soft";
  badge?: string;
  /**
   * Destaca o ÚLTIMO item da lista. Usado nos planos pagos para o estudo —
   * o diferencial em relação ao Gratuito — não se perder no meio de cinco
   * linhas idênticas que os três planos compartilham.
   */
  highlightLast?: boolean;
};

function PlanCard({
  name,
  price,
  priceUnit,
  hint,
  features,
  cta,
  href,
  variant,
  badge,
  highlightLast,
}: PlanCardProps) {
  const isPrimary = variant === "primary";
  return (
    <div
      className={cn(
        "relative flex flex-col gap-[22px] rounded-[24px] bg-scriba-paper p-6 sm:rounded-[26px] sm:p-8",
        isPrimary
          ? "border-[1.5px] border-scriba-blue shadow-[0_16px_40px_rgba(79,168,240,.18)]"
          : "border border-scriba-hairline"
      )}
    >
      {badge ? (
        <div className="absolute -top-[13px] left-6 rounded-[20px] bg-scriba-yellow px-[14px] py-[6px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-scriba-yellow-ink sm:left-7">
          {badge}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "text-[13px] font-semibold tracking-[.03em]",
            isPrimary ? "text-scriba-blue-ink" : "text-scriba-ink-soft"
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
      <div className="flex flex-col gap-2.5 pb-4 text-[13px] font-light text-scriba-ink-soft lg:text-[13.5px]">
        {features.map((f, i) => {
          const featured = highlightLast === true && i === features.length - 1;
          return (
            <div
              key={f}
              className={cn(
                "flex items-start gap-2.5",
                featured && "font-medium text-scriba-ink-strong"
              )}
            >
              <svg
                role="img"
                aria-label="Incluído"
                className={cn(
                  "mt-0.5 flex-none",
                  featured
                    ? "text-scriba-green"
                    : isPrimary
                      ? "text-scriba-blue-ink"
                      : "text-scriba-ink-mute"
                )}
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
          );
        })}
      </div>
      <Link
        href={href}
        className={cn(
          // `mt-auto` cola o botão no rodapé: com os cards esticados, a lista
          // de vantagens mais curta deixaria o CTA do Gratuito flutuando no
          // meio, desalinhado dos outros dois.
          "mt-auto inline-flex items-center justify-center gap-2 rounded-[24px] p-[15px] text-[12px] font-semibold uppercase tracking-[.04em]",
          isPrimary
            ? "scriba-cta bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)]"
            : "lp-cta-soft bg-scriba-btn-muted text-scriba-ink hover:bg-scriba-btn-muted-hover"
        )}
      >
        {isPrimary ? <ScribaMark size={18} /> : null}
        {cta}
      </Link>
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
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-scriba-yellow py-[17px] px-[38px] text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-yellow-ink shadow-[0_10px_24px_rgba(0,0,0,.2)]"
          >
            {/* currentColor: a pena acompanha o âmbar escuro do texto, em vez de
                sumir em branco sobre o amarelo */}
            <ScribaMark size={20} />
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
        color === "blue" && "text-scriba-blue-ink",
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
        "relative w-[390px] flex-none scale-[.75] rounded-[44px] bg-lp-phone-frame p-[11px] sm:scale-90 lg:scale-100",
        dark ? "phone-frame-dark" : "phone-frame"
      )}
    >
      <div className="phone-mask relative h-[680px] overflow-hidden rounded-[34px] bg-scriba-paper">
        <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between px-7 text-[12px] font-semibold text-scriba-ink">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-[14px] rounded-[2px] border-[1.4px] border-scriba-ink"
            />
          </div>
        </div>
        <div className="absolute left-1/2 top-[12px] z-10 h-6.5 w-26 -translate-x-1/2 rounded-[16px] bg-[#0B1220]" />
        {chrome ? (
          <div className="absolute inset-x-0 top-11 z-[5] bg-scriba-paper/95 backdrop-blur">
            {chrome}
          </div>
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
    // As três cores eram literais (`bg-red-600/[.08]`, `bg-[#DC2626]`,
    // `text-[#B91C1C]`) e por isso não trocavam com o tema: no escuro o texto
    // ficava a 2,55:1 sobre o fundo do mockup. Agora são tokens, conferidos nos
    // dois temas — claro 5,73:1, escuro 7,03:1.
    <div className="flex items-center gap-1.5 rounded-full bg-scriba-rec-soft px-2.5 py-1">
      <span className="size-1.5 rounded-full bg-scriba-rec shadow-[0_0_0_4px_rgba(220,38,38,.15)]" />
      <span className="text-[10px] font-bold tracking-[.08em] text-scriba-rec-ink">AO VIVO</span>
    </div>
  );
}

function LibraryMock() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-3">
      {LIB_GROUPS.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="text-xs font-semibold text-scriba-blue-ink">{group.label}</span>
            <span className="h-px flex-1 bg-scriba-hairline" />
            <span className="text-[11px] font-light text-scriba-ink-mute">
              {group.items.length}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {group.items.map((s) => (
              <li
                key={s.title}
                className="rounded-3xl border border-scriba-hairline-soft bg-scriba-paper p-4 shadow-[0_4px_14px_rgba(79,168,240,0.08)]"
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
                  <span className="rounded-full bg-scriba-blue-soft px-3.5 py-1.5 text-[11px] font-semibold text-scriba-blue-ink">
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
