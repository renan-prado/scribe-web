import Link from "next/link";
import { formatBrl, formatCoins, PLANS } from "@/lib/billing/plans";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
import { HeroEyebrow } from "@/shared/components/HeroEyebrow";
import { HeroEyebrowScript } from "@/shared/components/HeroEyebrowScript";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { LandingCta } from "@/shared/components/LandingCta";
import { LandingJsonLd } from "@/shared/components/LandingJsonLd";
import { LandingSummaryMock } from "@/shared/components/LandingMocks";
import { StandaloneHomeGuard } from "@/shared/components/StandaloneHomeGuard";
import { FAQ_ITEMS } from "@/shared/content/landing-faq";

export const metadata = {
  // `absolute` porque o template do layout é "%s": sem ele o título da LP
  // seria o mesmo da rota, e é aqui que o valor do Google é decidido.
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * A landing page é ESTÁTICA de propósito, nada aqui pode ler cookie, sessão
 * ou header, ou o Next volta a marcá-la como dinâmica.
 *
 * Antes ela chamava `supabase.auth.getUser()` para mandar quem já está logado
 * para `/feed`. Bastava isso para tornar a rota dinâmica, e o efeito ia longe:
 * cada visita anônima respondia `Cache-Control: private, no-store` com
 * `X-Vercel-Cache: MISS`, ou seja, HTML remontado do zero na origem, com duas
 * idas ao Supabase, uma no `proxy.ts` e outra aqui, antes do primeiro byte.
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
      {/* Dentro do PWA instalado esta página não é destino, ver
          `StandaloneHomeGuard`. Não custa estaticidade: é cliente puro. */}
      <StandaloneHomeGuard />
      <LandingHeader onLandingPage />
      {/* O `<main>` é o landmark que faltava, o resto do app já tem um, só a
          LP não tinha. Sem ele, quem navega por leitor de tela não consegue
          pular o header e cair direto no conteúdo. Não leva classe nenhuma: o
          hero sobe atrás do header por margem negativa, e qualquer coisa que
          criasse contexto de formatação novo aqui (overflow, display) quebraria
          esse encaixe. */}
      <main>
        <Hero />
        <Problem />
        <Resumo />
        <Biblioteca />
        <Plans />
        <Faq />
        <FinalCTA />
      </main>
      <LandingFooter onLandingPage />
    </div>
  );
}

/**
 * O hero sobe por trás do header (margem negativa = `--lp-header-h`) e devolve
 * o mesmo valor no padding do conteúdo, então o gradiente corre sob o header
 * translúcido sem deslocar nada do que está escrito.
 *
 * ## Por que uma coluna só, centrada
 *
 * Ele já foi duas colunas, texto à esquerda e telefone à direita. Numa tela de
 * 1200px isso dava 430px para o mockup e obrigava o título a caber em ~600px,
 * ou seja, a promessa da página competia por largura com a imagem dela. Em
 * coluna única o título ganha a linha inteira, a leitura desce numa ordem só
 * (pílula → promessa → explicação → botão → prova social → produto) e o
 * telefone deixa de ser um vizinho para virar o DESFECHO da dobra.
 *
 * O telefone é CORTADO no fim da seção, de propósito. Inteiro ele mede ~702px
 * e empurraria tudo o que vem depois para longe da primeira rolagem; cortado
 * na borda de baixo ele mostra o suficiente para se reconhecer como produto e
 * ainda deixa visível que há página embaixo. Quem faz o corte é a altura fixa
 * do invólucro com `overflow-hidden`, e é ela que precisa mudar junto se a
 * escala do `PhoneFrame` mudar: o `origin-top` existe para que a redução
 * encoste no topo, e não sobre folga no meio do recorte.
 */
function Hero() {
  return (
    <section className="relative mt-[calc(var(--lp-header-h)*-1)] overflow-hidden bg-[image:var(--lp-hero)]">
      {/* Os dois halos acompanharam a composição: com o texto no eixo, o azul
          vem de cima pelo centro e o dourado fica atrás do telefone. Ver
          "Os dois halos radiais do hero" em `src/shared/AGENTS.md`. */}
      <div className="pointer-events-none absolute -top-[260px] left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.16)_0%,rgba(79,168,240,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-[180px] left-1/2 hidden h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(248,198,75,.16)_0%,rgba(248,198,75,0)_70%)] lg:block" />
      <div className="relative mx-auto flex max-w-[780px] flex-col items-center gap-4 px-5 text-center pt-[calc(var(--lp-header-h)+2.25rem)] sm:px-10 lg:gap-6 lg:pt-[calc(var(--lp-header-h)+5rem)]">
        {/* A pílula é um componente CLIENTE porque ela se personaliza para
            quem chegou por um link de indicação ("Indicado por Fulano", com
            foto), e a LP não pode ler cookie sem deixar de ser estática.
            Ver o cabeçalho de `HeroEyebrow`. Não arrasta bundle: é um
            componente de `src/shared/`, sem nada de `src/features/`.

            O script vem ANTES dela no documento, e a ordem é o ponto: ele
            roda enquanto o parser ainda não chegou na pílula, então o estado
            inicial (frase ou esqueleto) já está decidido no primeiro paint.
            Mesmo padrão do `ThemeScript`. */}
        <HeroEyebrowScript />
        <HeroEyebrow />
        {/* Os três tamanhos são medidos, não escolhidos no olho: a frase tem
            60 caracteres, e o que decide cada degrau é quanto de margem sobra
            nas pontas da linha mais larga. No celular, 34px punha a segunda
            linha a 5px da borda e quebrava o título em QUATRO linhas de
            larguras muito diferentes (331, 294, 251, 242): sobra assimétrica
            nas pontas é lida como texto torto, mesmo com o bloco perfeitamente
            centrado. Em 27px são três linhas de 300/286/308 num vão de 340, e
            o título volta a ter margem dos dois lados. */}
        <h1 className="text-balance text-[27px] font-normal leading-[1.22] tracking-[-.02em] text-scriba-ink-strong sm:text-[40px] sm:leading-[1.14] sm:tracking-[-.025em] lg:text-[56px] lg:leading-[1.08]">
          Uma IA que anota tudo enquanto você presta atenção na mensagem
        </h1>
        {/* No celular a medida é MENOR que o vão disponível, e o texto é
            balanceado em vez de "pretty": no vão inteiro (340px) as linhas
            fechavam a 6px da borda, com a última sobrando curta, e um bloco
            que encosta nas duas pontas parece espremido mesmo estando
            centrado. Em 320px com `text-balance` saem cinco linhas quase
            iguais (230/232/232/221/246), com margem real dos dois lados. Do
            `sm` para cima o vão já é folgado e vale a regra normal. */}
        <p className="max-w-[320px] text-balance text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft sm:max-w-[580px] sm:text-pretty lg:text-[17.5px]">
          Enquanto você se concentra na pregação, aula da EBD, palestra, conversa entre amigos, o
          Scriba monta um resumo organizado para você revisitar quando quiser.
        </p>
        {/* O `pt` aqui é somado ao `gap` da coluna: o botão fica mais longe das
            duas frases do que as frases ficam uma da outra, e é essa diferença
            que separa "o que estamos dizendo" de "o que fazer a respeito".

            **Um destino só.** Aqui já houve um segundo botão, "Conhecer o
            Scriba", ancorando em `#recursos`. Num hero centrado ele passou a
            dividir o eixo com o CTA, e o que ele oferecia (rolar a página) é o
            que a pessoa faz sozinha de qualquer jeito: era uma escolha cobrada
            de quem ainda não tem como escolher. As âncoras continuam no header,
            para quem realmente quer pular. Ver `LandingCta`. */}
        <div className="flex w-full flex-col pt-5 sm:w-auto lg:pt-7">
          <LandingCta
            className="scriba-cta inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-[image:var(--scriba-cta)] py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink shadow-[0_9px_22px_var(--scriba-cta-shadow)]"
            icon={<ScribaMark size={20} />}
            label="Começar agora"
          />
        </div>
      </div>
      {/* O recorte do telefone. A altura é menor que a do mockup escalado em
          cada faixa (~527px, ~632px e 702px), e é essa diferença que produz o
          corte na borda de baixo da seção.

          **O que o corte precisa alcançar é a frase marcante.** O topo do
          resumo é texto cinza (ideia central, título, um parágrafo); o amarelo
          do `highlight` é a única cor do mockup, e é ele que faz a dobra
          parecer um produto em vez de um bloco de texto. Ao mexer nestas
          alturas, confira no navegador que a faixa amarela continua inteira
          dentro do recorte nas três faixas. */}
      <div className="relative mt-9 h-[496px] overflow-hidden sm:mt-11 sm:h-[596px] lg:mt-14 lg:h-[660px]">
        {/* A borda do recorte, esfumada. Sem isto o aparelho termina numa
            linha reta no meio de um parágrafo, e o corte parece falha de
            renderização em vez de escolha. O gradiente vai do transparente ao
            chão do hero (`--lp-hero` termina no mesmo tom em que o fundo da
            página continua), então ele apaga o telefone sem desenhar uma
            faixa própria por cima.

            Fica ACIMA do telefone (z-10) e não recebe clique. As três alturas
            são medidas para o esmaecimento COMEÇAR depois que a frase
            marcante termina (ela fecha a 364px, 436px e 485px do topo do
            recorte, uma medida por escala, e o esmaecimento abre a 384px,
            468px e 516px): mais alto e ele apaga a única cor da dobra, mais
            baixo e
            vira uma borda borrada, que é o mesmo problema com outro nome.
            Por isso as alturas do recorte logo acima e as daqui andam
            juntas. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-[linear-gradient(180deg,transparent_0%,var(--lp-hero-fade)_70%,var(--lp-hero-fade)_100%)] sm:h-32 lg:h-36"
        />
        <div className="flex justify-center">
          {/* O MESMO mockup da seção "O resumo", e de propósito: o hero promete
              um resumo organizado, então o que ele mostra é o resumo, não o
              feed ao vivo que estava aqui antes. A seção lá embaixo explica em
              texto o que esta imagem já adiantou. */}
          <PhoneFrame
            className="origin-top"
            chrome={<PhoneChrome subtitle="Resumo · 41 min" title="A sede que só Cristo cura" />}
          >
            <LandingSummaryMock lead />
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
 * As perguntas vêm de `src/shared/content/landing-faq.ts`, o mesmo módulo que
 * alimenta o JSON-LD `FAQPage`. Um texto aqui divergente do dado estruturado
 * derruba o rich result da página inteira, por isso a fonte é única.
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
          O que costumam perguntar...
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

/** Chip tinting for the summary tiles, one swatch per block of the resumo. */
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
              Ao final da mensagem, o Scriba transforma tudo o que foi dito em um resumo claro, para
              você entender, encontrar e relembrar o que realmente importa.
            </p>
          </div>
          {/* Cartões de papel com um chip colorido por bloco, a cor vira
              acento e não fundo, o que mantém a leitura calma e funciona igual
              nos dois temas. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
            {SUMMARY_BLOCKS.map((b) => (
              <div
                key={b.title}
                className="lp-lift flex flex-col gap-2.5 rounded-[20px] border border-scriba-hairline bg-scriba-paper p-4 shadow-[0_4px_16px_rgba(0,0,0,.06)] sm:p-5"
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
          {/* ⚠️ O que esta seção promete é o que `/api/sessions/search` faz, e
              nada além: procurar no que foi DITO e casar REFERÊNCIA bíblica
              com referência. Ela já prometeu que o Scriba "cruza sermões
              distantes no tempo e mostra quando dois deles falam da mesma
              coisa", e isso nunca foi desfeito na cópia quando a
              funcionalidade saiu do produto. Ao mexer aqui, confira a rota
              antes de escrever o verbo. */}
          <p className="max-w-[500px] text-pretty text-[14.5px] font-light leading-[1.62] text-lp-band-ink lg:text-[16px] lg:leading-[1.65]">
            Busque por tema, versículo ou pregador. O que o pregador disse fica procurável, e uma
            referência encontra o sermão mesmo quando ela foi citada de outro jeito.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:pt-2">
            <BiblioCard
              title="Busca por significado"
              subtitle={`"aquele sermão sobre perdão na família"`}
              badge="3 resultados"
            />
            <BiblioCard
              title="Busca por versículo"
              subtitle="João 4 · Isaías 55 · Salmo 42"
              badge="Acha a citação"
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
    // O véu era `bg-white/[.16]`, que CLAREAVA a banda, e o card é justamente
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

/**
 * Capacidades do produto, iguais em todos os planos; o que muda entre eles é
 * quantos créditos vêm por mês. Nome, preço e créditos NÃO moram aqui: saem de
 * `lib/billing/plans.ts`, o mesmo catálogo que o diálogo de compra e o
 * /profile leem. Antes disso a LP tinha números próprios, e eles já haviam
 * divergido do real (anunciava 2.000/5.000/100 créditos contra 1.000/2.500/50).
 * Preço de tela errado é promessa quebrada na hora do checkout.
 */
/**
 * O que cada plano entrega. Copy local de propósito, descreve CAPACIDADES, e
 * não valores; nome, preço e créditos vêm de `lib/billing/plans.ts`, o mesmo
 * catálogo do diálogo de compra (ver `app/AGENTS.md`).
 *
 * ⚠️ A lista era uma só para os três planos, e passou a mentir no dia em que o
 * estudo virou exclusivo de plano pago: o card do Gratuito prometia "Gerar
 * estudos", e o botão respondia 403. **Uma linha aqui é uma promessa que
 * `lib/entitlements/features.ts` tem de cumprir**, ao mexer numa, confira a
 * outra.
 */
type PlanFeature = {
  label: string;
  /** `false` desenha a linha como AUSENTE: X apagado no lugar do check. */
  included: boolean;
};

/** O que os três planos têm em comum. */
const BASE_FEATURES: PlanFeature[] = [
  { label: "Sermão comentado", included: true },
  { label: "Resumo organizado", included: true },
  { label: "Referências bíblicas", included: true },
  { label: "Biblioteca de sermões", included: true },
];

/**
 * O estudo é o que separa um plano pago do gratuito, e por isso ele fecha as
 * TRÊS listas, inclusive a do Gratuito, onde aparece apagada e com um X no
 * lugar do check.
 *
 * A ausência é dita, não omitida. Antes o Gratuito simplesmente tinha uma
 * linha a menos, e uma lista mais curta se lê como "tem menos coisa", não
 * como "esta coisa específica não vem" — quem comparava os cards de relance
 * não via o que estava faltando, e a diferença entre pagar e não pagar era
 * justamente ela. O 403 que o botão de estudo devolve depois do cadastro é o
 * que essa linha existe para antecipar. Ver `lib/entitlements/features.ts`.
 */
const STUDY_FEATURE = "Estudos bíblicos";

const FREE_FEATURES: PlanFeature[] = [...BASE_FEATURES, { label: STUDY_FEATURE, included: false }];

const PAID_FEATURES: PlanFeature[] = [...BASE_FEATURES, { label: STUDY_FEATURE, included: true }];

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
            ao topo ele ficava visivelmente menor, o que lê como plano
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
  features: PlanFeature[];
  cta: string;
  /** Destino do CTA. Nos planos pagos carrega a intenção via `?next=`, para
   * que a escolha sobreviva ao login e o usuário caia direto no Checkout. */
  href: string;
  variant: "primary" | "soft";
  badge?: string;
  /**
   * Destaca o ÚLTIMO item da lista. Usado nos planos pagos para o estudo,
   * o diferencial em relação ao Gratuito, não se perder no meio das linhas
   * idênticas que os três planos compartilham. A linha AUSENTE do Gratuito se
   * distingue sozinha, pelo X, e não precisa desta chave.
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
          ? "border-[1.5px] border-scriba-blue shadow-[0_16px_40px_rgba(0,0,0,.18)]"
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
              key={f.label}
              className={cn(
                "flex items-start gap-2.5",
                featured && "font-medium text-scriba-ink-strong",
                // A linha ausente é APAGADA, não alarmada. Ela já foi vermelha,
                // e vermelho num card de preço lê como erro, não como "este
                // plano não tem": puxava mais atenção que o próprio valor, num
                // lugar onde o que queremos é que a pessoa compare e siga.
                //
                // Quem carrega o aviso é a FORMA, o X, único na coluna inteira
                // e por isso visível de relance mesmo em cinza. A cor só
                // reforça, recuando a linha um degrau em relação às outras.
                !f.included && "text-scriba-ink-mute"
              )}
            >
              <svg
                role="img"
                aria-label={f.included ? "Incluído" : "Não incluído"}
                className={cn(
                  "mt-0.5 flex-none",
                  !f.included
                    ? "text-scriba-ink-mute"
                    : featured
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
                  d={f.included ? "M3 8.5L6.5 12L13 5" : "M4 4L12 12M12 4L4 12"}
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {f.label}
            </div>
          );
        })}
      </div>
      {/* `mt-auto` cola o botão no rodapé: com os cards esticados, a lista de
          vantagens mais curta deixaria o CTA do Gratuito flutuando no meio,
          desalinhado dos outros dois. O card Gratuito é o único `primary`, e
          no celular seu CTA abre a escolha entre instalar e seguir no navegador
          (ver `LandingCta`); os planos pagos seguem indo direto para o
          Checkout. */}
      {isPrimary ? (
        <LandingCta
          className="scriba-cta mt-auto inline-flex items-center justify-center gap-2 rounded-[24px] p-[15px] text-[12px] font-semibold uppercase tracking-[.04em] bg-[image:var(--scriba-cta)] text-scriba-cta-ink shadow-[0_8px_20px_var(--scriba-cta-shadow)]"
          icon={<ScribaMark size={18} />}
          label={cta}
          href={href}
        />
      ) : (
        <Link
          href={href}
          className="lp-cta-soft mt-auto inline-flex items-center justify-center gap-2 rounded-[24px] p-[15px] text-[12px] font-semibold uppercase tracking-[.04em] bg-scriba-btn-muted text-scriba-ink hover:bg-scriba-btn-muted-hover"
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
      {/* A MESMA faixa da seção "Sua biblioteca" e do bloco final dos
          parceiros (`--lp-band`), não mais um gradiente azul escrito à mão
          aqui. Eram três literais, `#33414F`/`#1F5E92` no fundo e
          `#CFE4F3`/`#AFCBE0` nos textos, que não trocavam com o tema e eram o
          "azulzão" que sobrou da paleta antiga. */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[30px] bg-[image:var(--lp-band)] p-9 text-white sm:gap-3.5 sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16">
        {/* Azul, como os halos do hero: com o botão amarelo fora daqui, o
            dourado deste halo era a última coisa amarela do bloco e ficava
            sozinho. O `.22` é o do halo original, não o `.16` do hero: aqui
            ele brilha sobre a faixa escura, não sobre o chão da página. */}
        <div className="pointer-events-none absolute -top-[90px] right-[60px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(79,168,240,.22)_0%,rgba(79,168,240,0)_70%)]" />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <div className="text-pretty text-[28px] font-semibold leading-[1.16] tracking-[-.022em] lg:text-[38px]">
            Use Scriba e ouça sem medo de esquecer.
          </div>
          <div className="text-[14px] font-light leading-[1.6] text-lp-band-ink lg:text-[16px] lg:leading-[1.62]">
            Crie sua conta em menos de um minuto e grave a primeira mensagem.
          </div>
        </div>
        <div className="relative flex flex-none flex-col items-stretch gap-3">
          <LandingCta
            className="lp-cta-yellow inline-flex items-center justify-center gap-2.5 rounded-[26px] bg-lp-band-cta py-[17px] px-[38px] text-[13px] font-semibold uppercase tracking-[.04em] text-lp-band-cta-ink shadow-[0_10px_24px_rgba(0,0,0,.2)]"
            // currentColor: a pena acompanha o âmbar escuro do texto, em vez de
            // sumir em branco sobre o amarelo
            icon={<ScribaMark size={20} />}
            label="Começar grátis"
          />
          <div className="text-center text-[11px] font-light text-lp-band-ink lg:text-[11.5px]">
            Sem cartão de crédito
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Phone mockups ---------- */

type PhoneFrameProps = {
  children: React.ReactNode;
  dark?: boolean;
  chrome?: React.ReactNode;
  /**
   * Só para ajustar a ÂNCORA da redução (`origin-*`) de quem recorta o
   * mockup, hoje o hero. A moldura em si (largura, raio, escala, cor) não se
   * customiza de fora: ela é a mesma nas três aparições, e é isso que faz as
   * três parecerem o mesmo aparelho.
   */
  className?: string;
};

function PhoneFrame({ children, dark = false, chrome, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative w-[390px] flex-none scale-[.75] rounded-[44px] bg-lp-phone-frame p-[11px] sm:scale-90 lg:scale-100",
        dark ? "phone-frame-dark" : "phone-frame",
        className
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
        <div className="absolute left-1/2 top-[12px] z-10 h-6.5 w-26 -translate-x-1/2 rounded-[16px] bg-[#050505]" />
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
                className="rounded-3xl border border-scriba-hairline-soft bg-scriba-paper p-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
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
