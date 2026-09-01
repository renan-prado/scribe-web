import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { PenaAvatar } from "@/features/session/components/PenaAvatar";
import type { SummaryBlock } from "@/lib/domain/summary";

/**
 * As telas de demonstração dentro dos mockups de celular da landing page.
 *
 * Antes a LP montava os componentes REAIS — `<Feed>` e `<SummaryView>` — para
 * desenhar estas duas telas. Fidelidade de graça, mas o custo era o bundle: os
 * dois são `"use client"` e arrastavam junto `FeedItemCard`, `VerseDialog`
 * (com o Dialog do base-ui), `useVerseFetch`, `PassageVerses`, `ScribaComment`
 * e os skeletons. A landing page — a única rota que um visitante anônimo
 * carrega, e a que decide se ele fica — baixava o app de gravação inteiro para
 * exibir cinco cards que nunca mudam e nunca respondem a clique.
 *
 * Aqui o markup é estático e roda no servidor: zero JS no cliente. O preço é
 * ter de reproduzir o visual à mão, e é um preço real — mexer no `FeedItemCard`
 * NÃO atualiza mais estas telas. É a troca certa mesmo assim, porque a LP e o
 * feed ao vivo têm razões diferentes para mudar: o feed muda quando o produto
 * muda, a LP quando a mensagem muda.
 *
 * O `BlockRenderer` do resumo é a exceção que continua reaproveitada: ele já
 * era server component (sem `"use client"`), então não custa bundle nenhum, e
 * são dez tipos de bloco que não vale duplicar.
 */

/* -------------------------------------------------------------------------- */
/*  Feed ao vivo                                                              */
/* -------------------------------------------------------------------------- */

/** Etiqueta no topo de cada card. Espelha `chipFor` do FeedItemCard. */
function Chip({ children, ai }: { children: React.ReactNode; ai: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 ${ai ? "text-scriba-ink-mute" : "text-session-chip-ai"}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{children}</span>
    </div>
  );
}

/**
 * Card autoral da IA: balão de chat saindo do avatar da pena, contorno
 * tracejado. Espelha o ramo `isAi` do FeedItemCard.
 */
function AiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="animate-content-fade flex items-start gap-2.5">
      <PenaAvatar />
      <article className="relative flex flex-1 flex-col gap-3 rounded-3xl rounded-tl-none bg-scriba-bubble px-5 py-4 text-scriba-bubble-ink">
        <Chip ai>{label}</Chip>
        {children}
      </article>
    </div>
  );
}

/**
 * Card originado da FALA do pregador: superfície de gradiente em vez do balão
 * tracejado. A distinção visual é a convenção do feed — ver AGENTS.md.
 */
function SpeakerCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="animate-content-fade">
      <article className="relative flex flex-1 animate-insight-gradient flex-col gap-3 rounded-[22px] bg-[image:var(--session-surface-quote)] bg-[size:200%_100%] p-5">
        <Chip ai={false}>{label}</Chip>
        {children}
      </article>
    </div>
  );
}

export function LandingFeedMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-3">
      <div className="flex flex-col gap-4">
        {/* speakerHighlight — quebra a moldura do card (HighlightBlock) */}
        <figure className="animate-content-fade mt-2 mb-6 flex flex-col items-center gap-1.5 px-4 text-center sm:mb-8 sm:px-8">
          <span
            aria-hidden
            className="select-none text-4xl font-semibold leading-none text-scriba-hairline-soft"
          >
            "
          </span>
          <blockquote className="text-pretty text-lg font-medium leading-relaxed text-scriba-ink-strong sm:text-xl">
            <span className="bg-[linear-gradient(transparent_58%,var(--session-highlight-yellow)_58%)] px-1 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              Jesus não oferece apenas água para a sede. Ele revela a sede que aquela mulher ainda
              não sabia nomear.
            </span>
          </blockquote>
        </figure>

        {/* context */}
        <AiCard label="Judeus e samaritanos">
          <p className="text-pretty text-sm font-light leading-relaxed text-scriba-ink">
            A conversa em João 4 rompe barreiras religiosas, étnicas e sociais. Ao pedir água a uma
            mulher samaritana, Jesus se aproxima de alguém que muitos judeus evitariam e transforma
            um encontro improvável em revelação.
          </p>
          <p className="text-[11px] font-light italic text-scriba-ink-mute">
            — Contexto histórico de João 4
          </p>
        </AiCard>

        {/* speakerCitation */}
        <SpeakerCard label="Citação na fala">
          <blockquote className="border-l-[3px] border-session-verse-border pl-3.5 text-[15px] font-light italic leading-relaxed text-session-verse-text">
            Fizeste-nos para Ti, e inquieto está o nosso coração enquanto não repousa em Ti.
          </blockquote>
          <p className="text-xs font-medium text-scriba-ink-soft">
            — Agostinho, citado pelo pregador
          </p>
        </SpeakerCard>

        {/* suggestedQuote */}
        <AiCard label="Citação sugerida">
          <blockquote className="text-sm font-light italic leading-relaxed text-scriba-ink">
            O meu povo cometeu dois males: abandonou a mim, a fonte de água viva, e cavou as suas
            próprias cisternas.
          </blockquote>
          <p className="text-xs font-medium text-scriba-ink-soft">— Jeremias 2:13</p>
          <p className="text-[11px] font-light leading-relaxed text-scriba-ink-mute">
            Conecta a água viva oferecida por Jesus às falsas fontes onde buscamos satisfação.
          </p>
        </AiCard>

        {/* speakerEcho — EchoBlock */}
        <figure className="animate-content-fade my-2 flex flex-col gap-2 border-l-2 border-scriba-hairline py-1 pl-4">
          <figcaption className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            Frase para relembrar
          </figcaption>
          <blockquote className="text-pretty text-base italic leading-relaxed text-scriba-ink/90 sm:text-lg">
            Cristo não veio apenas melhorar as nossas cisternas. Veio nos levar de volta à fonte.
          </blockquote>
        </figure>

        {/* Indicador de "digitando" — na LP é decorativo e fixo, então some o
            `role="status"` do original: não há nada a anunciar a um leitor de
            tela numa captura de tela parada. */}
        <div className="animate-content-fade flex items-start gap-2.5" aria-hidden>
          <PenaAvatar />
          <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md border border-dashed border-scriba-blue-soft bg-scriba-blue-soft/40 px-5 py-4">
            <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot" />
            <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot [animation-delay:200ms]" />
            <span className="size-1.5 animate-listening-dot rounded-full bg-session-typing-dot [animation-delay:400ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Resumo final                                                              */
/* -------------------------------------------------------------------------- */

const DEMO_SHORT_SUMMARY =
  "Em João 4, Jesus revela que nossa sede mais profunda não pode ser satisfeita pelas fontes deste mundo.";

/**
 * Só tipos de bloco que o `BlockRenderer` desenha sem tocar na rede.
 * Nada de `bibleQuote` (puxaria `PassageVerses`, que busca o texto do
 * versículo) nem de `contextCard`/`relatedVerse` (agrupariam em
 * `ScribaCommentGroup`, que é client). Manter assim ao editar a demo.
 */
const DEMO_BLOCKS: SummaryBlock[] = [
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
];

export function LandingSummaryMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-3">
      <div className="flex flex-col gap-7">
        <div className="-mb-2 flex flex-col gap-2 border-l-[2.5px] border-scriba-ink-soft pl-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-scriba-ink-mute">
            Ideia central
          </span>
          <p className="animate-content-fade text-pretty text-balance text-lg font-medium leading-snug text-scriba-ink-strong">
            {DEMO_SHORT_SUMMARY}
          </p>
        </div>
        {/* `blockKey` já é único nesta lista fixa (os textos são todos
            distintos), então não precisa do índice para desempatar. */}
        {DEMO_BLOCKS.map((block) => (
          <div
            key={`${block.type}-${blockKey(block)}`}
            className="animate-content-fade flex items-start sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <BlockRenderer block={block} />
            </div>
            <div aria-hidden className="hidden size-9 shrink-0 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
