import Link from "next/link";
// As LISTAS de vantagens dos cards saem de `plan-features.ts`, e não daqui:
// a mesma lista desenha o diálogo de compra da área logada. Ver o cabeçalho
// de lá. Preço, nome e créditos continuam vindo de `plans.ts`.
import { PLAN_FEATURES, type PlanFeature } from "@/features/billing/plan-features";
import { formatBrl, formatCoins, PLANS } from "@/features/billing/plans";
import { BIBLO_GIFT_MESSAGES } from "@/features/coins/pricing";
// O catálogo de funcionalidades por plano. A LP LÊ dele (o nome da feature e a
// frase de upsell do Biblo) em vez de redigitar as duas: é o mesmo princípio
// dos preços, que saem de `billing/plans`. Ambos são client-safe.
import { FEATURES } from "@/lib/entitlements/features";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ScribaMark } from "@/shared/brand";
// Caminho direto, não o barril: o barril reexporta os dois rostos, e só este
// é para carregar JS na LP. Ver `BibloHeroFace` e `BibloFace`.
import { BibloFace } from "@/shared/brand/BibloFace";
import { BibloHeroFace } from "@/shared/brand/BibloHeroFace";
import { HeroEyebrow } from "@/shared/components/HeroEyebrow";
import { HeroEyebrowScript } from "@/shared/components/HeroEyebrowScript";
import { LandingFooter, LandingHeader, SectionLabel } from "@/shared/components/LandingChrome";
import { LandingCta } from "@/shared/components/LandingCta";
import { LandingJsonLd } from "@/shared/components/LandingJsonLd";
import {
  LandingBibloMock,
  LandingEditorMock,
  LandingRecordingMock,
  LandingSummaryMock,
  LandingYoutubeImportingMock,
  LandingYoutubeMock,
  MockClock,
  MockSwap,
} from "@/shared/components/LandingMocks";
import { LandingParticles } from "@/shared/components/LandingParticles";
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
        {/* O que dá para fazer, numerado, uma TELA por seção. Elas são a
            estrutura da página, e não uma lista de recursos entre outras
            coisas: o hero promete um bloco de notas inteligente, que é uma
            promessa larga, e estas são a prova curta dela — gravar, escrever,
            importar e perguntar.

            **Importar virou seção PRÓPRIA, e não um parágrafo da de
            escrever.** As duas eram uma só ("Edite, escreva do zero ou traga
            de um vídeo"), e o resultado era uma seção com dois assuntos e uma
            tela — a do editor —, onde o YouTube existia como uma linha de
            texto. Ele é o caminho de quem NÃO estava no culto, é o único com
            preço fechado por uso, e é o único com uma pergunta própria a fazer
            (o recorte, "do minuto 12 ao 45"). Separadas, cada uma mostra a
            tela em que a pessoa vai cair.

            **"O problema" foi removido.** Era a trilha de três marcadores
            ("anotar divide sua atenção", "os detalhes desaparecem", "fica
            difícil encontrar"), e ela descrevia um produto que gravava sermões.
            Num bloco de notas em que escrever à mão e conversar sobre a Bíblia
            são metade do que se faz, ela vendia a dor de um terço da página, e
            vendia depois de as quatro telas já terem mostrado a solução. */}
        <Capabilities />
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
 * coluna única o título ganha a linha inteira e a leitura desce numa ordem só:
 * pílula → rosto do Biblo → promessa → explicação → botão.
 *
 * ## Não há mockup de celular aqui, e a ausência é a decisão
 *
 * O hero terminava com um aparelho CORTADO na borda de baixo, mostrando a tela
 * do resumo. Ele fazia sentido quando a página levava três seções para chegar
 * a uma tela do produto; hoje a seção seguinte é a primeira das três
 * capacidades, cada uma com o seu aparelho, e a primeira delas começa a ~150px
 * de onde o corte terminava.
 *
 * Então o que o recorte fazia era mostrar uma tela para dizer, 600px depois,
 * "aqui está a tela". Ele custava quase toda a altura da dobra (496px no
 * celular, 660px no desktop) e empurrava a primeira capacidade para fora da
 * primeira rolagem — a página gastava a peça mais cara que tinha para
 * antecipar o que já vinha logo em seguida.
 *
 * **Não devolva um mockup ao hero sem tirar um de baixo.** Quatro aparelhos na
 * mesma página é o mesmo objeto repetido até deixar de ser notado, e o do hero
 * seria o único sem uma frase ao lado dizendo o que ele é.
 */
function Hero() {
  return (
    // `overflow-hidden` fica, e agora é pelas PARTÍCULAS e pelos halos: os
    // dois sangram fora da caixa de propósito (o halo azul começa 260px acima
    // do topo), e sem o corte eles abrem barra de rolagem horizontal. Era do
    // recorte do telefone antes, que saiu.
    <section className="relative mt-[calc(var(--lp-header-h)*-1)] overflow-hidden bg-[image:var(--lp-hero)]">
      {/* UM halo, o azul, descendo pelo centro. A calibragem dele sobre o
          grafite está no token `--lp-halo-blue` do `globals.css`; aqui ficam
          só posição e tamanho.

          **O dourado saiu daqui.** Ele existia atrás do telefone do hero, e
          com o aparelho fora da dobra virou uma mancha âmbar chapada abaixo do
          CTA — um degradê pequeno e forte, sem nada na frente para quebrá-lo,
          lê como sujeira no fundo em vez de luz. Espalhá-lo (820px, mais
          baixo) só deixou a mancha maior. O token continua vivo na
          `/parceiros`, que é onde ele ainda tem um objeto por cima.

          Com um halo só, quem dá eixo à dobra é o DEGRADÊ do chão
          (`--lp-hero`): o azul marca o topo, o degradê desce, e o fim da seção
          é a mesma tinta do fundo da página. */}
      <div className="pointer-events-none absolute -top-[260px] left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[image:var(--lp-halo-blue)]" />
      {/* A poeira que sobe, atrás de tudo e na frente dos halos. Ela mora nos
          LADOS VAZIOS da dobra no desktop, onde a coluna de texto de 780px
          deixa vão; no miolo passam só quatro pontos pequenos. Ver
          `LandingParticles` para por que é CSS e por que as posições são uma
          lista. */}
      <LandingParticles />
      {/* O `pb` substitui o que o recorte do telefone fazia de graça: ele era
          o fim da seção, então a coluna de texto não precisava fechar nada.

          **Ele é bem menor que o `pt`, e isso é deliberado.** Com 128px aqui
          mais os 80px de topo da primeira capacidade, sobrava um vão de duas
          centenas de pixels que fazia a página parecer acabada no CTA. O vão
          que separa as duas seções é o da seguinte, que já tem o seu; o daqui
          só precisa dar ao degradê do chão espaço para morrer depois do
          botão. */}
      <div className="relative mx-auto flex max-w-[780px] flex-col items-center gap-4 px-5 pb-9 text-center pt-[calc(var(--lp-header-h)+2.25rem)] sm:px-10 sm:pb-12 lg:gap-6 lg:pb-16 lg:pt-[calc(var(--lp-header-h)+5rem)]">
        {/* A pílula é um componente CLIENTE porque ela se personaliza para
            quem chegou por um link de indicação ("Indicado por Fulano", com
            foto), e a LP não pode ler cookie sem deixar de ser estática.
            Ver o cabeçalho de `HeroEyebrow`. Não arrasta bundle: é um
            componente de `src/shared/`, sem nada de `src/features/`.

            O script vem ANTES dela no documento, e a ordem é o ponto: ele
            roda enquanto o parser ainda não chegou na pílula, então o estado
            inicial (frase ou esqueleto) já está decidido no primeiro paint.
            Mesmo padrão do bootstrap de tema que havia no `<head>`. */}
        <HeroEyebrowScript />
        <HeroEyebrow />
        {/* O Biblo, e os olhos dele seguem o ponteiro. É o segundo (e último)
            componente cliente do hero, e o único da página que existe para se
            MEXER — ver o cabeçalho de `BibloHeroFace` para o que isso custa e
            por que se aceitou aqui. Sem cursor (celular) ele fica parado, o
            que é o certo: não há o que seguir. */}
        <BibloHeroFace className="-mb-1" />
        {/* Os três tamanhos são medidos, não escolhidos no olho: a frase tem
            60 caracteres, e o que decide cada degrau é quanto de margem sobra
            nas pontas da linha mais larga. No celular, 34px punha a segunda
            linha a 5px da borda e quebrava o título em QUATRO linhas de
            larguras muito diferentes (331, 294, 251, 242): sobra assimétrica
            nas pontas é lida como texto torto, mesmo com o bloco perfeitamente
            centrado. Em 27px são três linhas de 300/286/308 num vão de 340, e
            o título volta a ter margem dos dois lados. */}
        <h1 className="text-balance text-[27px] font-normal leading-[1.22] tracking-[-.02em] text-scriba-ink-strong sm:text-[40px] sm:leading-[1.14] sm:tracking-[-.025em] lg:text-[56px] lg:leading-[1.08]">
          O bloco de notas inteligente que todo cristão deveria ter
        </h1>
        <HeroPromises />
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
            className="scriba-cta inline-flex items-center justify-center gap-2.5 rounded-full bg-[image:var(--scriba-cta)] py-[17px] px-8 text-[13px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink"
            icon={<ScribaMark size={20} />}
            label="Começar agora"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * O traço dos glifos dos cards do hero.
 *
 * Desenhados à mão pela razão de sempre nesta página: a LP não importa
 * `lucide-react` em lugar nenhum, e abrir essa porta por três ícones de 16px
 * numa dobra que precisa ser o HTML mais leve do site é trocar bundle por
 * nada. O quarto card não tem glifo, tem o ROSTO do Biblo (`BibloFace`), que é
 * `blobatar()` rodando no servidor: ali o ícone é o personagem.
 */
const HERO_ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * As QUATRO PROMESSAS, em cards curtos, logo abaixo do título do hero.
 *
 * Aqui havia um parágrafo de três linhas que dizia as quatro coisas de uma vez
 * ("Grave a pregação da sua igreja, importe uma reflexão do Youtube, escreva
 * seus próprios pensamentos ou converse com o Biblo, nossa IA expert nas
 * Escrituras, para tirar dúvidas e organizar seu resumo…"). Ele estava certo no
 * conteúdo e errado no formato: uma lista de quatro itens escrita como frase
 * corrida só entrega o quarto item a quem leu os três primeiros, e numa dobra
 * ninguém lê — ninguém varre. Em cards, as quatro chegam de relance, e a que
 * interessa àquela pessoa é encontrada em vez de esperada.
 *
 * **Uma linha por card, e curta.** A tentação é usar aqui os títulos das
 * seções de baixo, que são as mesmas quatro promessas por extenso; num card de
 * ~170px eles viram quatro linhas cada, e a dobra fica tão densa quanto o
 * parágrafo que saiu. O título da seção tem a página inteira para se explicar,
 * este card tem um relance.
 *
 * **Eles NÃO são links, e isso é a mesma decisão do botão único.** O hero já
 * teve um segundo botão ("Conhecer o Scriba", ancorando em `#recursos`), e ele
 * saiu porque dividia o eixo com o CTA oferecendo o que a pessoa faz sozinha:
 * rolar. Quatro cards clicáveis seriam esse botão de volta, multiplicado por
 * quatro, bem no caminho entre o título e a única ação da dobra. Quem quiser
 * pular tem as âncoras no header.
 *
 * ⚠️ São as mesmas quatro capacidades do `Capabilities`, na mesma ORDEM.
 * Capacidade nova lá é card novo aqui, ou a dobra passa a prometer três de
 * quatro.
 */
function HeroPromises() {
  const items: { label: string; icon: React.ReactNode }[] = [
    {
      label: "Grave e receba um resumo automático",
      icon: (
        // A onda da tela de gravação, em três barras. Elas abrem até as
        // bordas do `viewBox` (3 e 13, não 4 e 12) porque a mancha do ícone é
        // o que o olho compara na fileira: encolhidas ao meio, a onda lia como
        // um ícone menor que os três vizinhos, e não como um desenho mais
        // simples.
        <svg {...HERO_ICON} role="presentation">
          <path d="M3 5.4v5.2M8 2.6v10.8M13 5.4v5.2" />
        </svg>
      ),
    },
    {
      label: "Organize suas próprias ideias",
      icon: (
        <svg {...HERO_ICON} role="presentation">
          <path d="M10.6 2.8l2.6 2.6-7.4 7.4-3.4.8.8-3.4 7.4-7.4Z" />
        </svg>
      ),
    },
    {
      label: "Resuma um vídeo do YouTube",
      icon: (
        <svg {...HERO_ICON} viewBox="0 0 24 24" fill="currentColor" role="presentation">
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.2 22 12 22 12s0-3.2-.4-4.8ZM9.9 15.1V8.9l5.4 3.1-5.4 3.1Z" />
        </svg>
      ),
    },
    {
      label: "Converse sobre Bíblia com o Biblo",
      // UM DEGRAU MAIOR que os glifos, e não é engano: os três vizinhos são
      // traçados que quase encostam nas bordas do `viewBox`, e o rosto é uma
      // forma cheia que ocupa 66% do dele (medido: 65,7 de 100). Desenhado na
      // mesma caixa, ele aparecia como o menor item da fileira. A 20px a
      // MANCHA dos quatro se iguala, que é o que o olho compara — e ele
      // transborda a caixa de 16 por 2px de cada lado sem mexer no layout,
      // porque quem mede é a caixa (ver o `IconBox`).
      icon: <BibloFace size={20} className="size-5" />,
    },
  ];

  return (
    // DOIS por linha no celular e QUATRO do `sm` para cima. Em coluna única
    // eles empurrariam o CTA para fora da dobra, que é o oposto do que esta
    // troca foi fazer; em quatro colunas num vão de 340px cada card fica com
    // 78px e a frase quebra em quatro linhas.
    //
    // O `mt-1` é somado ao `gap` da coluna do hero: os cards não são a
    // continuação da frase do título, são o bloco seguinte.
    <ul className="mt-1 grid w-full grid-cols-2 gap-2 sm:max-w-[680px] sm:grid-cols-4 sm:gap-2.5">
      {items.map((item) => (
        <li
          key={item.label}
          // `items-start` e não `items-center`: as frases têm uma ou duas
          // linhas conforme a largura, e com o ícone centrado na caixa ele
          // dançava de card para card na mesma fileira. Alinhado ao topo, os
          // quatro ícones ficam na mesma altura, que é o que faz a fileira ler
          // como uma fileira.
          className="flex items-start gap-2 rounded-2xl bg-scriba-paper/70 p-3 text-left ring-1 ring-scriba-hairline ring-inset sm:flex-col sm:gap-2.5 sm:p-3.5"
        >
          {/* A CAIXA do ícone, e ela é `flex` de propósito.
              Um `span` inline com um SVG dentro ganha a descida da fonte por
              baixo do desenho — no card do Biblo, cuja cara é um `inline-flex`,
              isso virava 8px de vão fantasma entre o rosto e a frase, e só ali.
              Com `flex` não há caixa de linha, e a medida fixa mantém os quatro
              ícones na mesma altura mesmo quando o desenho de dentro é maior
              que ela. */}
          <span
            aria-hidden
            className="mt-px flex size-4 flex-none items-center justify-center text-scriba-ink-soft sm:mt-0"
          >
            {item.icon}
          </span>
          <span className="text-pretty text-[12.5px] font-light leading-[1.35] text-scriba-ink sm:text-[13px]">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * As perguntas vêm de `src/shared/content/landing-faq.ts`, o mesmo módulo que
 * alimenta o JSON-LD `FAQPage`. Um texto aqui divergente do dado estruturado
 * derruba o rich result da página inteira, por isso a fonte é única.
 */
function Faq() {
  return (
    <section
      id="perguntas"
      className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 sm:px-10 sm:py-24 lg:gap-12"
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

/* ---------- As três coisas que dá para fazer ---------- */

/**
 * As três capacidades do produto, numeradas, uma seção cada, com a tela de
 * cada uma ao lado.
 *
 * ## Por que numeradas, e por que só três
 *
 * "Bloco de notas inteligente" é uma promessa larga, e promessa larga precisa
 * de prova curta. As três respondem "o que eu faço com isto?" na ordem em que
 * uma pessoa entra no produto: o domingo (gravar), a semana (escrever, importar,
 * editar) e a dúvida (perguntar). O número não é enfeite de lista — ele diz que
 * são TRÊS, e que a página acaba de contar todas.
 *
 * Aqui já houve uma seção de cartões ("Três maneiras de começar") mais uma
 * seção "O resumo" com quatro chips. Eram as mesmas três coisas dividas em
 * dois lugares, e nenhum dos dois mostrava a tela da gravação — a landing
 * falava de gravar exibindo o RESULTADO de gravar, que é a parte que a pessoa
 * já imaginou.
 *
 * ## As telas alternam de lado, e a primeira é a da gravação
 *
 * `reverse` inverte a coluna do mockup no desktop. No celular a ordem é sempre
 * texto → tela, porque ali não há dois lados: o `order` só entra do `lg` para
 * cima.
 *
 * ⚠️ Cada `<Capability>` PROMETE uma tela. Ao mexer numa delas, confira o
 * mockup correspondente em `LandingMocks.tsx`: as quatro
 * (`LandingRecordingMock`, `LandingEditorMock`, `LandingYoutubeMock`,
 * `LandingBibloMock`) são markup próprio, então mudar o app não as atualiza.
 */
type Capability = {
  /**
   * Só para a `key` da lista e para a ordem de leitura do código.
   *
   * **Ele não vai mais para a tela.** Cada seção tinha um disco numerado com
   * um rótulo ao lado ("1 · GRAVAR"), e com quatro seções aquilo virou
   * paginação: a pessoa passava a ler "estou no passo 2 de 4" numa página em
   * que nada é passo — as quatro são coisas independentes, e ninguém precisa
   * fazer a 1 para fazer a 3. O título de cada uma já diz do que ela trata, e
   * é mais específico que o rótulo que o anunciava.
   */
  n: number;
  title: string;
  body: string;
  /** Os detalhes, em linhas curtas. Três é o máximo que se lê de relance. */
  points: string[];
  /** A linha de preço. `null` quando não custa crédito nenhum. */
  cost: string | null;
  /** Segunda linha, miúda, para o que o preço não diz. */
  note?: string;
  screen: React.ReactNode;
  /** Ancora o link do header. Só a do Biblo tem, hoje. */
  id?: string;
  /** No desktop, joga a tela para a ESQUERDA. */
  reverse?: boolean;
  /**
   * Põe o rosto do Biblo à esquerda do título.
   *
   * É uma chave e não um `ReactNode` porque a resposta é sim ou não: o rosto é
   * do personagem, e só a seção que fala dele o merece. Um `ReactNode` aqui
   * seria um convite para pendurar um ícone em cada uma das três, e aí o rosto
   * deixa de significar "este é o Biblo" e passa a significar "esta é uma
   * seção".
   */
  face?: boolean;
};

function Capabilities() {
  const items: Capability[] = [
    {
      n: 1,
      id: "recursos",
      title: "Grave a pregação e saia com um resumo automático.",
      body: "Grave uma pregação, aula da EBD, reunião de grupo ou uma conversa entre amigos e o Scriba transcreve tudo e gera um resumo organizado com todas as referências bíblicas e ideias centrais.",
      points: [
        "Transcrição e resumos automáticos",
        "Os versículos citados ficam linkados na anotação",
        "Revisite quando fizer sentido",
      ],
      cost: null,
      note: "",
      screen: (
        // DUAS telas que se revezam, e é a seção em que isso mais importa: a
        // frase promete "grave a pregação E saia com um resumo", e um quadro
        // parado só consegue mostrar a metade que a pessoa já imaginou. A
        // segunda é o resumo pronto, que é o que ela veio conferir. Ver
        // `MockSwap`.
        //
        // O CABEÇALHO troca junto, e não é enfeite: "Gravando" com o ponto
        // vermelho por cima de um resumo pronto desmentiria a tela inteira.
        // Os dois são de uma linha só (nenhum tem subtítulo) porque o palco
        // tira a altura do PRIMEIRO, e um segundo mais alto desceria o fio de
        // baixo do cabeçalho por cima do conteúdo.
        //
        // O cabeçalho é o da `TopBar` de verdade: o título diz o estado e o
        // relógio fica à DIREITA, com o ponto de gravação ao lado dele — e o
        // relógio CONTA (ver `MockClock`). Um relógio parado num mockup que
        // promete "grave a pregação" é a única coisa na tela que desmente a
        // frase ao lado dela.
        <PhoneFrame
          chrome={
            <MockSwap>
              <PhoneChrome
                title="Gravando"
                right={
                  <span className="flex items-center gap-2">
                    <RecDot />
                    <MockClock />
                  </span>
                }
              />
              <PhoneChrome title="A sede que só Cristo cura" />
            </MockSwap>
          }
        >
          <MockSwap>
            <LandingRecordingMock />
            <LandingSummaryMock />
          </MockSwap>
        </PhoneFrame>
      ),
    },
    {
      n: 2,
      title: "Escreva suas próprias ideias",
      body: "Crie uma anotação do zero ou edite um resumo gerado pelo Scriba. O nosso editor foi criado para você ter todas as ideias claras com um design limpo e moderno.",
      points: [
        "Título, parágrafo, passagem bíblica, destaque, citação e conclusão",
        "Tenha um resumo estruturado do seu jeito",
        "O mesmo editor, quer o conteúdo tenha sido gerado ou escrito manualmente",
      ],
      cost: null,
      note: "",
      reverse: true,
      screen: (
        // TRÊS momentos de uma edição: o texto como estava, o menu do `+`
        // aberto e o bloco novo sendo digitado, com o cursor piscando. O
        // cabeçalho é o mesmo nos três, porque a anotação é a mesma.
        <PhoneFrame
          chrome={<PhoneChrome subtitle="Anotação · 41 min" title="A sede que só Cristo cura" />}
        >
          <MockSwap>
            <LandingEditorMock />
            <LandingEditorMock state="menu" />
            <LandingEditorMock state="written" />
          </MockSwap>
        </PhoneFrame>
      ),
    },
    {
      n: 3,
      title: "Resumos automáticos de vídeos do YouTube",
      body: "Assistiu algum vídeo no Youtube que mexeu com você? Copie e cole o link do video no Scriba e importamos a transcrição e montamos um resumo organizado para você.",
      points: [
        "Transcrição de tudo que é falado no vídeo",
        "Resumo automático e organizado do conteúdo",
        "Liberdade para editar e acrescentar suas próprias ideias",
      ],
      cost: null,
      note: "",
      screen: (
        // As TRÊS etapas que o texto ao lado descreve: o link colado, o Scriba
        // trabalhando e o resumo pronto. A do meio é a que responde "e depois
        // que eu colo o link?" — sem ela a seção mostra um formulário e um
        // resultado, e o trabalho, que é a parte que o Scriba faz no lugar da
        // pessoa, acontece fora da tela.
        <PhoneFrame
          chrome={
            <MockSwap>
              <PhoneChrome title="Importar" />
              <PhoneChrome title="Importar" />
              <PhoneChrome title="A sede que só Cristo cura" />
            </MockSwap>
          }
        >
          <MockSwap>
            <LandingYoutubeMock />
            <LandingYoutubeImportingMock />
            <LandingSummaryMock />
          </MockSwap>
        </PhoneFrame>
      ),
    },
    {
      n: 4,
      id: "biblo",
      face: true,
      reverse: true,
      title: "Converse com o Biblo sobre qualquer assunto da bíblia",
      body: "O Biblo é nosso expert nas Escrituras, ele é capaz de te ajudar a tirar dúvidas, organizar suas ideias e até sugerir contéudo para adicionar em suas anotações.",
      points: [
        "Tire dúvidas sobre qualquer assunto da Bíblia",
        "Sugestões de conteúdo para suas anotações",
        "Versículos e ideias relacionadas ao conteúdo que você está estudando",
      ],
      cost: null,
      note: `${FEATURES.biblo_chat.upsell} Na conta gratuita, te presenteamos com ${BIBLO_GIFT_MESSAGES} mensagens grátis para você conhecer o nosso expert.`,
      screen: (
        <PhoneFrame
          chrome={<PhoneChrome subtitle="Anotação · 41 min" title="A sede que só Cristo cura" />}
        >
          <LandingBibloMock />
        </PhoneFrame>
      ),
    },
  ];

  return (
    <>
      {items.map((item) => (
        <CapabilitySection key={item.n} item={item} />
      ))}
    </>
  );
}

function CapabilitySection({ item }: { item: Capability }) {
  return (
    // `py-8` no celular contra `py-20` do desktop, e a distância é de propósito:
    // ali a seção é uma coluna só, então o respiro entre duas seções é a soma
    // dos dois paddings (64px), enquanto no desktop ele separa blocos que já
    // estão lado a lado. Com os 48px de antes, o par texto + tela ficava mais
    // perto da seção vizinha do que de si mesmo.
    <section id={item.id} className="mx-auto max-w-[1200px] px-5 py-8 sm:px-10 sm:py-20">
      <div
        className={cn(
          "flex flex-col items-center gap-6 lg:grid lg:items-center lg:gap-16",
          item.reverse ? "lg:grid-cols-[420px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_420px]"
        )}
      >
        <div
          className={cn(
            // No celular o TEXTO vem primeiro: é ele que diz do que a seção
            // trata, e uma tela de aparelho antes do título é uma imagem sem
            // legenda ocupando a dobra inteira. O `lg:order-*` continua
            // alternando os lados no desktop, onde há dois.
            "order-1 flex min-w-0 flex-col gap-5 lg:gap-6",
            item.reverse ? "lg:order-2" : "lg:order-1"
          )}
        >
          {/* O `gap` entre o título e a descrição é maior que o das outras
              colunas desta página (12px), e é por causa do TAMANHO do título:
              ele tem 38px com `leading-[1.16]`, então duas linhas dele fecham
              num bloco alto e denso, e um parágrafo de 16px a 12px dele lê
              como continuação da frase em vez de explicação dela. Com o vão de
              20px o título respira e a descrição volta a ser um segundo
              assunto.

              Ele não sobe junto com o `gap` da coluna inteira: o que separa o
              título do corpo é uma relação de hierarquia, e o que separa o
              corpo da lista de fios é outra. */}
          <div className="flex flex-col gap-5">
            {/* Com rosto, o título vira duas linhas empilhadas no celular e
                dois itens lado a lado do `sm` para cima.

                **No celular o rosto fica ACIMA do título**, e a razão é a
                largura: ali o título tem ~340px, e com o rosto ao lado sobram
                ~280 para três linhas de 27px — cada uma perdia uma palavra para
                o vão, e a promessa da seção quebrava em lugares que ninguém
                escolheu. Empilhado, o título recupera a linha inteira e o rosto
                continua anunciando de quem é a seção, uma linha antes.

                Do `sm` para cima eles voltam a dividir a linha, alinhados pelo
                TOPO: o título tem duas linhas e o rosto acompanha a primeira,
                que é onde a leitura começa — centrado na caixa inteira ele
                flutuaria no meio do vão.

                O TAMANHO é o das duas linhas do título: 88px no desktop, que
                é a altura de duas linhas de 38px com `leading-[1.16]`, e o
                rosto passa a pesar como o texto ao lado em vez de parecer um
                ícone pendurado nele. No celular ele cai para 60px, que é o
                degrau em que ele lê como personagem sem virar ilustração da
                seção.

                Quem manda no tamanho é a CLASSE, não o `size`: o `size` fica
                como piso, para o caso de o CSS não carregar. Escalar por CSS
                não desalinha o gaze — a excursão está em unidades do `viewBox`,
                que não mudam com a caixa. */}
            {item.face ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
                <BibloHeroFace className="size-15 sm:mt-1 sm:size-22" size={88} />
                <h2 className="text-pretty text-[27px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[38px]">
                  {item.title}
                </h2>
              </div>
            ) : (
              <h2 className="text-pretty text-[27px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[38px]">
                {item.title}
              </h2>
            )}
            <p className="max-w-[520px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[16px] lg:leading-[1.65]">
              {item.body}
            </p>
          </div>
          {/* Os detalhes como lista de fios, o mesmo desenho dos três pontos
              que a seção do Biblo já usava: eles são leitura de relance, e
              cartão para cada um daria peso de seção a uma linha de texto. */}
          <ul className="flex flex-col">
            {item.points.map((point) => (
              <li
                key={point}
                className="border-t border-scriba-hairline py-3 text-pretty text-[13.5px] font-light leading-[1.55] text-scriba-ink-soft sm:py-3.5 sm:text-[14.5px]"
              >
                {point}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            {/* A moeda aparece só onde há cobrança por uso. No Biblo o preço
                por mensagem existe mas NÃO vai para a tela (ver `COIN_COSTS`),
                então a linha dele é a de plano, e sem hexágono. */}
            {item.cost ? (
              <div className="flex items-center gap-1.5 text-[12.5px] font-light text-scriba-ink-mute lg:text-[13px]">
                <CoinHex />
                {item.cost}
              </div>
            ) : null}
            {item.note ? (
              <p className="max-w-[440px] text-pretty text-[12px] font-light leading-[1.6] text-scriba-ink-mute lg:text-[12.5px]">
                {item.note}
              </p>
            ) : null}
          </div>
        </div>
        <div
          className={cn(
            "order-2 -mx-5 flex min-w-0 justify-center overflow-hidden sm:mx-0 sm:overflow-visible",
            item.reverse ? "lg:order-1" : "lg:order-2"
          )}
        >
          {item.screen}
        </div>
      </div>
    </section>
  );
}

/**
 * O ponto vermelho da `TopBar` durante a gravação.
 *
 * `--scriba-rec` é a família do "gravando" no produto inteiro (ver
 * `src/shared/AGENTS.md`), e é o único vermelho que a landing usa. Ele existe
 * aqui porque um relógio sozinho no cabeçalho não diz se está correndo ou
 * parado, e é justamente isso que a seção 1 promete.
 */
function RecDot() {
  return <span aria-hidden className="block size-2.5 rounded-full bg-scriba-rec" />;
}

function Biblioteca() {
  return (
    // O CHÃO da página, como as quatro seções de capacidade logo acima, e não
    // mais a faixa elevada (`--lp-band`). A faixa dizia "esta seção é outra
    // coisa", e ela não é: é a quinta tela do produto, na mesma conversa das
    // outras quatro — a diferença que ela anunciava era de desenho, não de
    // assunto. Quem separa é o FIO de 1px, a regra do resto do produto (ver
    // `src/shared/AGENTS.md`), o mesmo que abre a seção de planos.
    //
    // Com o chão embaixo, o que inverte é a relação dos CARTÕES: eles eram o
    // chão sobre a faixa e passam a ser a superfície elevada sobre o chão (ver
    // `BiblioCard`). A faixa continua viva no bloco final (`FinalCTA`), onde
    // ela é um cartão gigante e não uma seção.
    <section className="relative overflow-hidden border-scriba-hairline border-t">
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-6 px-5 py-10 text-scriba-ink-strong sm:px-10 sm:py-20 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
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
          {/* `ink-soft`, a tinta de corpo das outras seções, e não a
              `lp-band-ink`: aquela é calibrada sobre a faixa, que saiu daqui. */}
          <p className="max-w-[500px] text-pretty text-[14.5px] font-light leading-[1.62] text-scriba-ink-soft lg:text-[16px] lg:leading-[1.65]">
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
                  <span className="rounded-full bg-v2-card px-2.5 py-1 text-[10px] font-semibold text-v2-ink">
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
    // O cartão SOBE para a superfície elevada (`--v2-card`), agora que a
    // seção ficou no chão da página: é a mesma relação de sempre, cartão sobre
    // tela, só que na ordem certa. Ele já foi o chão em cima da faixa, quando a
    // faixa é que era a superfície, e antes disso um véu de preto a 14% — uma
    // terceira tinta inventada para esta seção. Com as duas superfícies do app
    // a relação se resolve sozinha e a página tem dois tons, não cinco.
    //   título 12,1 · subtítulo 6,4 · badge 8,4 (medidos sobre o papel)
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-scriba-paper p-4 px-[17px] sm:px-[18px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] font-semibold sm:text-[13.5px]">{title}</div>
        <div className="text-[11.5px] font-light text-scriba-ink-soft sm:text-[12px]">
          {subtitle}
        </div>
      </div>
      <div className="flex-none whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.04em] text-v2-note-lemon">
        {badge}
      </div>
    </div>
  );
}

function Plans() {
  return (
    // Sem faixa de fundo própria: `--scriba-surface` virou o próprio chão, e a
    // seção se separa pelo fio de 1px, como os meses da Biblioteca.
    <section id="planos" className="border-t border-scriba-hairline">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 sm:px-10 sm:py-[92px] lg:gap-12">
        <div className="flex flex-col gap-3 lg:items-center lg:text-center">
          <SectionLabel color="blue">Planos</SectionLabel>
          <h2 className="text-pretty text-[29px] font-semibold leading-[1.16] tracking-[-.022em] text-scriba-ink-strong lg:text-[42px] lg:leading-[1.14]">
            O editor é grátis. Você paga pela IA.
          </h2>
          {/* A ESTRATÉGIA dita em voz alta, e não uma frase de vitrine.

              O título já foi "Comece grátis. Cresça quando fizer sentido.", que
              é o que toda tela de planos diz e não descreve produto nenhum:
              "comece grátis" promete um período, e quem lê entende amostra. Não
              é amostra. O editor manual é o produto, ele não acaba, e a
              monetização mora inteira nas funcionalidades de IA.

              Dizer isso aqui não é generosidade anunciada: é o que faz a pessoa
              criar a conta sem calcular quando vai ser cobrada. Quem escreve os
              próprios esboços fica de graça para sempre — e é justamente essa
              pessoa que um dia vai querer que a máquina escreva o primeiro
              rascunho por ela.

              A linha anterior dizia o que não pedimos (contrato, cartão), que é
              uma promessa em negativo: tira um medo e não dá nada. */}
          <p className="max-w-[560px] text-[13.5px] font-light leading-[1.6] text-scriba-ink-soft lg:text-[15.5px]">
            Escrever, organizar e guardar seus textos não custa nada e nunca vai custar. Os créditos
            existem para quando você quiser que o Scriba transcreva, resuma e escreva por você.
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
            tagline={PLANS.pessoal.tagline}
            features={PLAN_FEATURES.pessoal}
            cta={`Assinar ${PLANS.pessoal.name}`}
            href="/sign-in?next=%2Fbilling%2Fassinar%3Fplan%3Dpessoal"
            variant="soft"
          />
          <PlanCard
            name={PLANS.free.name}
            price="Grátis"
            hint={`${formatCoins(PLANS.free.coins)} créditos de boas-vindas`}
            tagline={PLANS.free.tagline}
            features={PLAN_FEATURES.free}
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
            tagline={PLANS.estudioso.tagline}
            features={PLAN_FEATURES.estudioso}
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
  /** A frase do plano, de `PLANS[*].tagline`: para QUEM ele é, antes das linhas do que ele tem. */
  tagline: string;
  features: PlanFeature[];
  cta: string;
  /** Destino do CTA. Nos planos pagos carrega a intenção via `?next=`, para
   * que a escolha sobreviva ao login e o usuário caia direto no Checkout. */
  href: string;
  variant: "primary" | "soft";
  badge?: string;
};

function PlanCard({
  name,
  price,
  priceUnit,
  hint,
  tagline,
  features,
  cta,
  href,
  variant,
  badge,
}: PlanCardProps) {
  const isPrimary = variant === "primary";
  return (
    <div
      className={cn(
        "relative flex flex-col gap-[22px] rounded-[24px] bg-scriba-paper p-6 sm:rounded-[26px] sm:p-8",
        // O plano em destaque se anuncia por um ANEL branco de 1,5px, não por
        // sombra: sobre o grafite a sombra não aparece, e o que sobrava era
        // uma borda de cor de marca que não existe mais.
        isPrimary ? "ring-[1.5px] ring-inset ring-scriba-ink-strong" : ""
      )}
    >
      {badge ? (
        // AMARELO não, porque amarelo é a MOEDA em todo o produto (ver
        // `src/shared/AGENTS.md`), e "Sem cartão" não é um preço. A pastilha é
        // a mesma tinta do anel do cartão em destaque.
        <div className="absolute -top-[13px] left-6 rounded-full bg-scriba-ink-strong px-[14px] py-[6px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-background sm:left-7">
          {badge}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "text-[13px] font-semibold tracking-[.03em]",
            isPrimary ? "text-scriba-ink-strong" : "text-scriba-ink-soft"
          )}
        >
          {name}
        </div>
        {/* Para quem o plano é, em cima do preço: é a pergunta que a pessoa faz
            antes de olhar o número, e responder depois dele obriga a subir de
            novo para comparar. */}
        <div className="text-[12.5px] font-light leading-[1.45] text-scriba-ink-soft lg:text-[13px]">
          {tagline}
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[12.5px] font-light text-scriba-ink-mute lg:text-[13px]">
            <CoinHex />
            {hint}
          </div>
        </div>
      </div>
      <div className="h-px bg-scriba-hairline-soft" />
      <div className="flex flex-col gap-2.5 pb-4 text-[13px] font-light text-scriba-ink-soft lg:text-[13.5px]">
        {features.map((f) => {
          const featured = f.featured === true;
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
              {/* O ROSTO no lugar do check, na linha do Biblo.

                  Ele é a única coisa do produto com cara, nome e primeira
                  pessoa, e escrito em texto corrido no meio de cinco linhas
                  iguais não lembra disso ninguém: quem já leu a seção dele
                  reconhece a cara antes de ler a frase. É o mesmo rosto da
                  seção acima e o mesmo de dentro do app, porque é a mesma
                  função pura sobre a mesma semente (ver `BibloFace`), e não
                  custa um byte de JS na LP.

                  Ele ocupa a mesma caixa de 16px do check, senão a linha sai do
                  alinhamento das outras quatro. Não custa acessibilidade: o
                  check tem `aria-label` porque ele CARREGA a informação
                  incluído/ausente, e esta linha só existe como incluída. */}
              {f.face ? (
                // CINZA no Gratuito, colorido nos pagos. O rosto é a única
                // coisa colorida da lista, e no card em que o Biblo é um
                // presente com fim ele não pode ser o ponto mais vivo dos três
                // cards. Um `grayscale` diz isso pela mesma imagem, sem um
                // segundo desenho para manter: é o mesmo Biblo, com a cor
                // guardada para quem assina. Vale toda linha com rosto que não
                // seja `featured`, que por definição é só a do Gratuito.
                <BibloFace
                  size={16}
                  className={cn("mt-0.5 size-4", !featured && "grayscale")}
                  title="Incluído"
                />
              ) : (
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
              )}
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
          // A borda cinza é `--scriba-hairline`, o mesmo fio que separa as
          // seções e desenha a moldura de todo cartão do produto. Ela existe
          // porque `--scriba-btn-muted` (#2F3035) está a um degrau do papel do
          // card: sem o fio, o botão dos planos pagos não tem onde começar e
          // acaba, e o único CTA com contorno visível na seção é o do Gratuito.
          className="lp-cta-soft mt-auto inline-flex items-center justify-center gap-2 rounded-[24px] border border-scriba-hairline p-[15px] text-[12px] font-semibold uppercase tracking-[.04em] bg-scriba-btn-muted text-scriba-ink hover:bg-scriba-btn-muted-hover"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-10 sm:py-24">
      {/* A faixa (`--lp-band`), a mesma do bloco final dos parceiros, e não
          mais um gradiente azul escrito à mão aqui. Ela é o ÚNICO lugar da LP
          que ainda a usa, desde que a seção "Sua biblioteca" desceu para o
          chão: aqui ela não é seção, é um cartão gigante com cantos e halo
          próprios — a última tela da página, que pede para ser olhada. Eram três literais, `#33414F`/`#1F5E92` no fundo e
          `#CFE4F3`/`#AFCBE0` nos textos, que não trocavam com o tema e eram o
          "azulzão" que sobrou da paleta antiga. */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[30px] bg-[image:var(--lp-band)] p-9 text-scriba-ink-strong sm:gap-3.5 sm:rounded-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-16">
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
        // A MARGEM NEGATIVA é o par obrigatório do `scale`, não um ajuste fino.
        //
        // `transform` não mexe no layout: o aparelho continua ocupando os 702px
        // da caixa (680 de tela + 11 de moldura em cima e embaixo) mesmo
        // desenhando 527 no celular. Os 175px que sobram viram vão morto em
        // volta dele, 87,5 de cada lado, e no celular — onde a seção é uma
        // coluna — esse vão entra INTEIRO entre o texto e a tela que ele
        // promete, somado ao `gap` da coluna. Era o maior espaço em branco da
        // página, e não havia nada nele.
        //
        // A conta: `(702 × (1 − escala)) / 2`. A 0,75 dá 87,5px; a 0,9, 35px; a
        // 1 não sobra nada e a margem zera. **Mexeu na escala ou na altura da
        // tela, refaça os três números** — eles não se ajustam sozinhos, e
        // errar para mais faz a seção seguinte subir por cima do aparelho.
        "relative w-[390px] flex-none scale-[.75] rounded-[44px] bg-lp-phone-frame p-[11px] sm:scale-90 lg:scale-100",
        "-my-[87.5px] sm:-my-[35px] lg:my-0",
        dark ? "phone-frame-dark" : "phone-frame",
        className
      )}
    >
      {/* A tela do aparelho é o CHÃO do app (`--v2-bg`), não o papel: é o que
          a pessoa vê ao abrir o Scriba, e o mockup só convence se for a mesma
          cor. */}
      <div className="phone-mask relative h-[680px] overflow-hidden rounded-[34px] bg-v2-bg">
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
          <div className="absolute inset-x-0 top-11 z-[5] bg-v2-bg/95 backdrop-blur">{chrome}</div>
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

/**
 * As quatro faces do post-it, na ORDEM do `PostItNote`. Aqui elas são fixas,
 * uma por posição, porque num mockup não há id de sessão para sortear — e o
 * que o mural precisa mostrar é que as cores se alternam, não qual cor cabe a
 * qual sermão. Só o cartão escuro leva o fio de luz, pela mesma razão de lá:
 * contra o chão ele dá 1,25:1 e sem o fio lê como buraco.
 */
const MOCK_NOTES = [
  "bg-v2-note-mist text-v2-note-mist-ink [&_.note-mute]:text-v2-note-mist-mute",
  "bg-v2-note-lemon text-v2-note-lemon-ink [&_.note-mute]:text-v2-note-lemon-mute",
  "bg-v2-note-slate text-v2-note-slate-ink ring-1 ring-inset ring-white/10 [&_.note-mute]:text-v2-note-slate-mute",
  "bg-v2-note-sage text-v2-note-sage-ink [&_.note-mute]:text-v2-note-sage-mute",
] as const;

/**
 * A Biblioteca dentro do aparelho: o MURAL de post-its, duas colunas.
 *
 * Aqui havia uma lista de fichas — resumo curto, local, duração e um botão
 * "Ver resumo →" —, que é o cartão que o app teve até a pele nova. A landing
 * mostrando a tela anterior do produto é pior que mockup nenhum: a pessoa
 * instala esperando aquilo.
 *
 * O desenho é o do `PostItNote`, reproduzido à mão pela razão que o cabeçalho
 * de `LandingMocks` explica (o componente de verdade é um link, e traria
 * `NavLink` e o bundle de sessão para a única página que todo visitante
 * anônimo carrega). O que NÃO é reproduzido são os tokens: as cores saem das
 * mesmas variáveis `--v2-note-*`, então repintar o acervo repinta a landing.
 */
function LibraryMock() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-3">
      {LIB_GROUPS.map((group, gi) => (
        <section key={group.label} className="flex flex-col gap-3">
          <h2 className="px-1 text-[15px] font-medium text-v2-ink-soft">{group.label}</h2>
          {/* `columns-2` + `break-inside-avoid` + `mb-4`: o mesmo masonry de
              CSS da Biblioteca, em que o vão vertical sai da margem do item e
              o horizontal do `gap`. */}
          <ul className="columns-2 gap-4">
            {group.items.map((s, i) => (
              // O `flex` fica no filho, e o `<li>` só carrega cor e quebra:
              // um item de coluna com `display:flex` faz alguns navegadores
              // ignorarem o `break-inside-avoid` e cortarem o cartão ao meio na
              // virada. Mesma montagem do `PostItNote`.
              <li
                key={s.title}
                className={cn(
                  "mb-4 break-inside-avoid rounded-2xl",
                  MOCK_NOTES[(gi * 2 + i) % MOCK_NOTES.length]
                )}
              >
                <div className="flex flex-col gap-1.5 p-4">
                  <span className="note-mute text-[11px] font-medium">{s.speaker}</span>
                  <span className="text-pretty text-[14px] font-semibold leading-tight tracking-tight">
                    {s.title}
                  </span>
                  <span className="note-mute pt-1 text-[11px] font-light">{s.date}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * O acervo do mockup. São NOVE sessões em três meses, e a quantidade é o
 * ponto: com três cartões o mural aparecia como duas colunas quase vazias num
 * aparelho de 680px, e o que a seção promete é justamente o contrário — "anos
 * de pregação, finalmente buscáveis". A máscara do `PhoneFrame` corta os
 * últimos, que é o que diz que há mais coisa embaixo.
 *
 * Os meses são o mesmo agrupamento da Biblioteca de verdade (ver
 * `LibraryBrowser`), e não "esta semana / semana passada": quem grava um
 * sermão por domingo enche um mês, não uma semana.
 */
const LIB_GROUPS = [
  {
    label: "Setembro",
    items: [
      {
        title: "A sede que só Cristo cura",
        speaker: "Pr. João Silva",
        date: "24 set",
      },
      {
        title: "O jugo leve",
        speaker: "Pr. João Silva",
        date: "17 set",
      },
      {
        title: "Quando o perdão custa caro",
        speaker: "Pra. Ana Ribeiro",
        date: "10 set",
      },
      {
        title: "A casa que Deus edifica",
        speaker: "Pr. Roberto Nunes",
        date: "3 set",
      },
    ],
  },
  {
    label: "Agosto",
    items: [
      {
        title: "O que sobra depois da tempestade",
        speaker: "Pr. João Silva",
        date: "27 ago",
      },
      {
        title: "Duas casas, duas fundações",
        speaker: "Pr. Roberto Nunes",
        date: "20 ago",
      },
      {
        title: "O menor dos grãos",
        speaker: "Pra. Ana Ribeiro",
        date: "13 ago",
      },
    ],
  },
  {
    label: "Julho",
    items: [
      {
        title: "Ide, e fazei discípulos",
        speaker: "Pr. João Silva",
        date: "30 jul",
      },
      {
        title: "A mesa posta diante dos meus adversários",
        speaker: "Pr. Roberto Nunes",
        date: "23 jul",
      },
    ],
  },
];
