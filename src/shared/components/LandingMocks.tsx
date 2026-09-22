import { Children } from "react";
// Caminho direto, e não o barril `@/shared/brand`: ele reexporta o
// `BibloAvatar`, que é `"use client"` — exatamente o que esta página não pode
// carregar. Ver o cabeçalho de `BibloFace`.
import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { LeadIdea } from "@/features/session/components/LeadIdea";
import type { SummaryBlock } from "@/lib/domain/summary";
import { cn } from "@/lib/utils";
import { BibloFace } from "@/shared/brand/BibloFace";
import { ScribaMark } from "@/shared/brand/ScribaMark";
import { BookGlyph } from "@/shared/icons/BookGlyph";

/**
 * As telas de demonstração dentro dos mockups de celular da landing page.
 *
 * Antes a LP montava os componentes REAIS, `<Feed>` e `<SummaryView>`, para
 * desenhar estas duas telas. Fidelidade de graça, mas o custo era o bundle: os
 * os dois eram `"use client"` e arrastavam junto meia dúzia de componentes de
 * sessão. A landing page, a única rota que um visitante anônimo carrega, e a
 * que decide se ele fica, baixava o app de gravação inteiro para exibir telas
 * que nunca mudam e nunca respondem a clique.
 *
 * Aqui o markup é estático e roda no servidor: zero JS no cliente. O preço é
 * ter de reproduzir o visual à mão, e é um preço real, mexer no componente de
 * verdade NÃO atualiza mais estas telas. É a troca certa mesmo assim, porque a
 * LP e o app têm razões diferentes para mudar: o app muda quando o produto
 * muda, a LP quando a mensagem muda.
 *
 * O `BlockRenderer` do resumo é a exceção que continua reaproveitada: ele já
 * era server component (sem `"use client"`), então não custa bundle nenhum, e
 * são dez tipos de bloco que não vale duplicar.
 */

/* -------------------------------------------------------------------------- */
/*  Resumo final                                                              */
/* -------------------------------------------------------------------------- */

const DEMO_SHORT_SUMMARY =
  "Em João 4, Jesus revela que nossa sede mais profunda não pode ser satisfeita pelas fontes deste mundo.";

/**
 * Só tipos de bloco que o `BlockRenderer` desenha sem tocar na rede.
 * Nada de `bibleQuote`: ele puxaria `PassageVerses`, que busca o texto do
 * versículo. Manter assim ao editar a demo.
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

/* -------------------------------------------------------------------------- */
/*  O palco: as telas que trocam sozinhas                                     */
/* -------------------------------------------------------------------------- */

/**
 * As animações de cada fatia, por número de estados. Ver o bloco
 * `--animate-lp-slide-*` do `globals.css`, que é onde mora o porquê.
 */
const SLIDE_ANIMATIONS: Record<number, readonly string[]> = {
  2: ["var(--animate-lp-slide-2a)", "var(--animate-lp-slide-2b)"],
  3: ["var(--animate-lp-slide-3a)", "var(--animate-lp-slide-3b)", "var(--animate-lp-slide-3c)"],
};

/**
 * Empilha dois ou três estados de uma tela e os alterna sozinho, em CSS.
 *
 * **Cada seção da landing promete uma TRANSIÇÃO, e um quadro parado mostra
 * sempre a metade errada dela.** A da gravação exibia o aparelho gravando, que
 * é justamente a parte que a pessoa já imaginou, e nunca o resumo pronto, que é
 * o que ela veio conferir. O mesmo valia para as outras três: o editor sem o
 * bloco sendo escrito, a importação sem a importação acontecendo, o Biblo sem a
 * resposta chegando.
 *
 * **Zero JavaScript, como o resto da página.** É a única rota que um visitante
 * anônimo carrega inteira, e um carrossel com estado no cliente custaria a ela
 * um componente `"use client"` por mockup — ver o cabeçalho deste arquivo. As
 * fatias são keyframes de opacidade com atrasos diferentes sobre a mesma
 * duração, então o navegador desenha isso na thread de composição e a página
 * continua estática.
 *
 * **A altura sai de um FANTASMA, não de um número.** Os estados são todos
 * absolutos (é o que os põe no mesmo lugar), e uma caixa só de filhos absolutos
 * mede zero; então o primeiro estado é renderizado mais uma vez, no fluxo e
 * invisível, só para dar altura ao palco. Escrever a altura à mão aqui seria
 * mais uma medida para manter em sincronia com a tela do `PhoneFrame`, e este
 * arquivo já tem uma dessas (ver `LandingRecordingMock`).
 *
 * `aria-hidden` no palco inteiro: são fotos de tela, e quem lê por áudio já
 * recebeu do parágrafo ao lado tudo o que elas mostram. Sem isso, um leitor de
 * tela anunciaria as três versões da MESMA tela, em sequência, como se fossem
 * três conteúdos.
 */
export function MockSwap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const states = Children.toArray(children);
  const animations = SLIDE_ANIMATIONS[states.length];
  if (!animations) {
    // Build-time, e de propósito: a landing é pré-renderizada, então um palco
    // com um número de estados para o qual não há keyframe quebra o build em
    // vez de subir uma seção que não troca de tela.
    throw new Error(`MockSwap: ${states.length} estados, e só há animação para 2 ou 3.`);
  }
  return (
    <div aria-hidden className={cn("relative", className)}>
      <div className="lp-swap-ghost h-full">{states[0]}</div>
      {states.map((state, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: as fatias são posições fixas de uma lista literal, não dados
          key={`slide-${index}`}
          className="lp-slide"
          style={{ animation: animations[index] }}
        >
          {state}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  O resumo pronto                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A tela de LEITURA: a ideia central, o título e os blocos, como em
 * `/summary/[id]`.
 *
 * É o segundo estado da seção de gravar (o "saia com um resumo automático" da
 * frase ao lado) e o terceiro da importação, e nos dois ela entra por
 * `MockSwap`. Só uns 570px dela cabem na tela do aparelho, e o corte é o
 * assunto: a ordem dos blocos aqui é escolhida para que a FRASE DE DESTAQUE —
 * a parte do resumo que não se parece com nada que a pessoa escreveria à mão —
 * apareça antes de o aparelho acabar. Ver `SCREEN_BLOCKS`.
 *
 * O `LeadIdea` e o `BlockRenderer` são os componentes DE VERDADE, e essa é a
 * exceção à regra do cabeçalho deste arquivo: os dois são servidor puro, não
 * custam bundle, e reproduzi-los à mão foi o que um dia deixou a landing
 * mostrando a estética anterior do resumo depois de a do app mudar.
 */
const SCREEN_BLOCKS: SummaryBlock[] = DEMO_BLOCKS.slice(0, 3);

export function LandingSummaryMock() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
      <LeadIdea label="Ideia central" text={DEMO_SHORT_SUMMARY} />
      {SCREEN_BLOCKS.map((block) => (
        <div key={blockKey(block)} className="min-w-0">
          <BlockRenderer block={block} />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  O editor                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * O traço dos glifos do editor, desenhados à mão pela razão do `DRAWER_ICON`
 * logo abaixo: a LP não importa `lucide-react` em lugar nenhum, e abrir essa
 * porta por sete ícones de 14px numa tela que nunca responde a clique é
 * trocar bundle por nada.
 *
 * As duas exceções são as que o menu de verdade (`escrever/blocks.tsx`) também
 * não tira do lucide: a `BookGlyph` da passagem bíblica e o `ScribaMark` da
 * ideia central. Esses são os MESMOS componentes do app, servidor puro, e é
 * justamente onde um segundo desenho faria a pessoa escolher uma coisa na
 * landing e ver outra no editor.
 */
const EDITOR_ICON = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * A fileira do menu do `+`, na ORDEM e com os RÓTULOS de `BLOCK_OPTIONS`, com
 * a ideia central na frente (`LEAD_OPTION`).
 *
 * ⚠️ Ganhou ou perdeu opção no editor? Esta lista muda junto, ou a landing
 * promete um menu que não existe.
 */
const EDITOR_CHIPS: { label: string; icon: React.ReactNode }[] = [
  { label: "Ideia central", icon: <ScribaMark className="size-3" /> },
  {
    label: "Parágrafo",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M9 2.5v11M12.5 2.5v11M9 2.5H6.2a2.85 2.85 0 0 0 0 5.7H9" />
      </svg>
    ),
  },
  {
    label: "Título",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M2.5 3v10M8 3v10M2.5 8H8M10.8 6.6 12.5 5.5V13" />
      </svg>
    ),
  },
  {
    label: "Subtítulo",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M2.5 3v10M7.5 3v10M2.5 8h5M10.2 6.9a1.6 1.6 0 0 1 3.1.2c0 1.6-3.1 2.4-3.1 4.4h3.2" />
      </svg>
    ),
  },
  { label: "Bíblia", icon: <BookGlyph className="size-3" /> },
  {
    label: "Frase de destaque",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M9.6 2.6 13.4 6.4 8 11.8 4.2 8 9.6 2.6ZM6.1 9.9 4.4 11.6l1.3 1.3 1.7-1.7M2.5 14.4h11" />
      </svg>
    ),
  },
  {
    label: "Informação",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M6.4 13.2h3.2M6.9 14.9h2.2M8 1.6a4.2 4.2 0 0 0-2.6 7.5c.4.4.6.9.6 1.4h4c0-.5.2-1 .6-1.4A4.2 4.2 0 0 0 8 1.6Z" />
      </svg>
    ),
  },
  {
    label: "Citação",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M6.6 4.2C4.9 4.9 3.8 6.3 3.8 8.2v3.6h3.5V8.2H5.6c0-1 .5-1.7 1.4-2.2l-.4-1.8ZM13.4 4.2c-1.7.7-2.8 2.1-2.8 4v3.6h3.5V8.2h-1.7c0-1 .5-1.7 1.4-2.2l-.4-1.8Z" />
      </svg>
    ),
  },
  {
    label: "Conclusão",
    icon: (
      <svg {...EDITOR_ICON} role="presentation">
        <path d="M3.6 14.4V2.2h8.8l-1.7 2.9 1.7 2.9H3.6" />
      </svg>
    ),
  },
];

/** O estado do editor que cada fatia do `MockSwap` mostra. Ver o componente. */
type EditorState = "base" | "menu" | "written";

/**
 * O texto do bloco que está sendo ESCRITO na terceira fatia. Curto e cortado no
 * meio de propósito: o que a seção promete é o ato de escrever, e uma frase
 * inteira com ponto final é um bloco pronto, não um bloco em andamento.
 *
 * Ele continua o sermão de `DEMO_BLOCKS` (João 4), como tudo o mais nesta
 * página: o mesmo poço, a mesma sede.
 */
const EDITOR_TYPED_TEXT = "A promessa não é um poço melhor, é uma fonte que";

/**
 * `/escrever` dentro do aparelho, em TRÊS estados que o `MockSwap` alterna: o
 * bloco já escrito com a linha do fim, o menu do `+` aberto, e o bloco novo
 * sendo digitado.
 *
 * **Os três compartilham as mesmas coordenadas**, e é isso que faz a troca de
 * fatia parecer uma ação em vez de um corte: o parágrafo de cima não sai do
 * lugar em nenhuma delas, então o que a pessoa vê é o menu abrindo onde estava
 * o `+`, e depois um bloco nascendo onde o menu estava. Ao mexer em qualquer
 * um deles, confira os três — um bloco a mais em um só transforma a
 * dissolvência num pulo.
 *
 * Aqui morava o `LandingSummaryMock`, a tela de LEITURA, e era a tela errada
 * para esta seção: ao lado de um texto que promete um editor, o aparelho
 * mostrava o resultado pronto, que é o que as outras telas da página já
 * mostram. O que falta provar nesta é que existe um lugar onde se ESCREVE.
 *
 * Os blocos já escritos são o `BlockRenderer` DE VERDADE, e não uma cópia,
 * porque é assim no editor também: cada `textarea` do `Composer` veste as
 * classes do bloco correspondente (ver o `BlockBody` dele). A promessa da
 * seção — a edição acontece no lugar onde se lê — sai do próprio código em vez
 * de ser reproduzida à mão. **A exceção é o bloco que está sendo digitado**: o
 * cursor precisa nascer no fim do texto, dentro do parágrafo, e para isso as
 * classes do `paragraph` do `BlockRenderer` estão copiadas ali. Mexeu nelas
 * lá? Mexa aqui.
 *
 * O que É reproduzido à mão são os CONTROLES (a caixa acesa do bloco em foco,
 * a pílula de mover e excluir, o disco do `+`, o menu e a linha do fim), pela
 * razão do cabeçalho deste arquivo: o `Composer` é `"use client"` e traria o
 * editor inteiro, o seletor de passagens e o Biblo junto.
 *
 * ⚠️ As medidas não são livres: a caixa de um bloco é o `BLOCK_SURFACE` do
 * `Composer` (`-mx-3 -my-2 … px-3 py-2`), o disco tem 24px e o vão entre
 * blocos é `gap-8`. Mexeu lá, confira aqui.
 */
export function LandingEditorMock({ state = "base" }: { state?: EditorState }) {
  return (
    // Os vãos são mais curtos que os do editor (`gap-4` no lugar do `gap-6` do
    // cabeçalho, `pb-2` no lugar do `pb-24`) por uma razão de MOCKUP, não de
    // desenho: a tela do aparelho tem 572px úteis, e com o menu aberto —
    // cinco fileiras de pastilhas num telefone de 390px — a linha do fim caía
    // fora dela. O que a seção precisa mostrar é justamente o par `+` e as
    // pastilhas; o que sobra de folga no app é o que dá para apertar.
    <div className="flex flex-col gap-4 px-4 pb-2 pt-3">
      {/* A linha do cabeçalho do editor: o que está salvo, e o atalho para a
          leitura. Mesmos tokens do `StatusChip` e do "Ver como ficou". */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-mint px-2.5 py-1 font-semibold text-[10px] text-scriba-mint-accent uppercase tracking-wider">
          <span className="size-1.5 rounded-full bg-scriba-mint-accent" />
          Salvo
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-scriba-ink-mute/10 px-3 py-1.5 font-semibold text-[11px] text-scriba-ink-soft uppercase tracking-wider">
          <svg {...EDITOR_ICON} className="size-3.5" role="presentation">
            <path d="M1.6 8S4 3.8 8 3.8 14.4 8 14.4 8 12 12.2 8 12.2 1.6 8 1.6 8Z" />
            <circle cx="8" cy="8" r="1.9" />
          </svg>
          Ver como ficou
        </span>
      </div>

      <div className="flex flex-col gap-8">
        <div className="h-px w-full bg-scriba-hairline" />

        {/* O parágrafo que já estava escrito. Ele é o ponto FIXO das três
            fatias: só perde a pílula e a superfície acesa quando o cursor
            muda para o bloco novo, na terceira. */}
        <EditorBlock lit={state !== "written"}>
          <BlockRenderer block={DEMO_BLOCKS[1]} />
        </EditorBlock>

        {/* O bloco NOVO, meio digitado, com o cursor piscando no fim. É a
            terceira fatia inteira: a resposta do "escreva suas próprias
            ideias" que nenhuma tela parada dá. */}
        {state === "written" ? (
          <EditorBlock lit>
            <p className="text-pretty text-[15px] font-light leading-[1.72] text-scriba-ink">
              {EDITOR_TYPED_TEXT}
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-scriba-ink-strong"
                style={{ animation: "var(--animate-lp-caret)" }}
              />
            </p>
          </EditorBlock>
        ) : null}

        {/* O MENU DO `+`, aberto, ou a linha do fim, nunca os dois: no editor
            de verdade o menu nasce NO lugar da linha, e é por isso que a fatia
            do meio não empurra nada para baixo. */}
        {state === "menu" ? <EditorMenu /> : <EditorEndLine />}
      </div>
    </div>
  );
}

/**
 * Um bloco do editor: a superfície acesa do `BLOCK_SURFACE` e a pílula de
 * mover e excluir, quando o cursor está nele.
 *
 * A PÍLULA diz que cada trecho se move e se apaga, e o `+` dela insere ACIMA; a
 * lixeira aparece apagada, como todo `ControlButton` sem ação — aqui nada tem
 * ação. A SUPERFÍCIE é como o editor responde "é aqui que o cursor está", e no
 * celular é a única resposta possível, porque ali não há ponteiro.
 */
function EditorBlock({ children, lit }: { children: React.ReactNode; lit?: boolean }) {
  if (!lit) return <div className="min-w-0">{children}</div>;
  return (
    <div className="relative">
      <div className="absolute right-0 bottom-full z-10 flex items-center gap-0.5 rounded-full bg-scriba-surface p-1 shadow-sm ring-1 ring-scriba-hairline ring-inset">
        {[
          { d: "M8 3.5v9M3.5 8h9", mute: false },
          { d: "M4.5 9.8 8 6.2l3.5 3.6", mute: false },
          { d: "M4.5 6.2 8 9.8l3.5-3.6", mute: false },
          { d: "M3.2 4.5h9.6M6.4 4.5V3h3.2v1.5M4.8 4.5l.6 8.5h5.2l.6-8.5", mute: true },
        ].map((glyph) => (
          <span
            key={glyph.d}
            aria-hidden
            className={cn(
              "inline-flex size-6.5 items-center justify-center rounded-full",
              glyph.mute ? "text-scriba-ink-mute/40" : "text-scriba-ink-soft"
            )}
          >
            <svg {...EDITOR_ICON} role="presentation">
              <path d={glyph.d} />
            </svg>
          </span>
        ))}
      </div>
      <div className="-mx-3 -my-2 rounded-[20px] bg-scriba-blue-soft/60 px-3 py-2">{children}</div>
    </div>
  );
}

/**
 * O menu do `+`, aberto. O `×` nasce onde o `+` estava — mesmo disco, mesmo
 * lugar, só o glifo muda — e as pastilhas QUEBRAM em linhas em vez de rolar na
 * horizontal: a Conclusão é a última, e precisa existir para quem não descobre
 * que aquilo arrasta.
 *
 * A pastilha do PARÁGRAFO aparece escolhida, e é ela que amarra esta fatia à
 * seguinte: o bloco que nasce lá é um parágrafo. Trocou o bloco digitado?
 * Troque a pastilha acesa.
 */
function EditorMenu() {
  return (
    <div className="-mx-1 flex items-start gap-2 rounded-[20px] bg-scriba-surface p-2">
      {/* `h-[26px]`: a altura da linha de texto, para o `×` pousar onde o
          `+` estava. */}
      <span className="flex h-[26px] shrink-0 items-center">
        <span
          aria-hidden
          className="inline-flex size-6 items-center justify-center rounded-full border border-scriba-hairline text-scriba-ink-mute"
        >
          <svg {...EDITOR_ICON} className="size-3.5" role="presentation">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </span>
      </span>
      <span className="-my-0.5 flex min-w-0 flex-1 flex-wrap gap-1.5">
        {EDITOR_CHIPS.map((chip) => {
          const chosen = chip.label === "Parágrafo";
          return (
            <span
              key={chip.label}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-medium text-[11.5px]",
                chosen
                  ? "border-transparent bg-scriba-ink text-scriba-paper"
                  : "border-scriba-hairline text-scriba-ink-soft"
              )}
            >
              {chip.icon}
              {chip.label}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * A linha do fim: o disco do `+` e uma linha em branco onde se escreve sem
 * escolher nada antes. É ela que mantém o menu OPCIONAL, quem quer um
 * parágrafo digita.
 */
function EditorEndLine() {
  return (
    <div className="-mx-3 -my-2 flex items-center gap-2 rounded-[20px] py-2 pr-3 pl-2">
      <span
        aria-hidden
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-scriba-hairline text-scriba-ink-mute"
      >
        <svg {...EDITOR_ICON} className="size-3.5" strokeWidth={2} role="presentation">
          <path d="M8 3.5v9M3.5 8h9" />
        </svg>
      </span>
      <span className="font-light text-[15px] text-scriba-ink-mute/60 leading-[1.72]">
        Escreva…
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  A conversa com o Biblo                                                    */
/* -------------------------------------------------------------------------- */

/**
 * O traço dos ícones da gaveta, desenhados à mão pela mesma razão dos ícones
 * da seção "O resumo" em `(site)/page.tsx`: são quatro glifos de 14px, e não
 * vale abrir a porta do `lucide-react` numa página que hoje não importa
 * nenhum.
 */
const DRAWER_ICON = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * A gaveta do Biblo por cima do resumo, dentro do `PhoneFrame`.
 *
 * **O resumo continua VISÍVEL atrás, e isso é a feature, não enfeite**: a
 * conversa é sobre o texto que está na tela (`docs/biblo.md` §3), e uma gaveta
 * opaca contaria a história errada. Por isso o véu é translúcido e a folha
 * ocupa dois terços da altura, como no app.
 *
 * O desenho é reproduzido à mão (medidas, raios e tokens copiados de
 * `BibloDrawer` e `BibloMessage`) pela razão do cabeçalho deste arquivo: os
 * componentes de verdade são `"use client"` e trariam o app da sessão inteiro
 * para a LP. A exceção é o ROSTO, que é o mesmo `blobatar()` do app, só
 * renderizado no servidor — ver `BibloFace`.
 *
 * ⚠️ Os dois balões e o trecho sugerido falam de João 4, a MESMA passagem do
 * `LandingEditorMock` (os dois leem `DEMO_BLOCKS`). Se a demo mudar de sermão,
 * esta conversa muda junto, ou a página mostra um Biblo conversando sobre
 * outra tela.
 */
export function LandingBibloMock() {
  return (
    <>
      {/* O resumo, atrás. Só uns 120px dele aparecem acima da folha, e é o
          bastante para se reconhecer a tela de leitura. */}
      <div className="px-4 pt-3">
        <LeadIdea label="Ideia central" text={DEMO_SHORT_SUMMARY} />
      </div>
      {/* O véu: o chão do app a 72%, o mesmo peso do header da LP sobre a
          página. Ele escurece o resumo sem apagá-lo. */}
      <div aria-hidden className="absolute inset-0 bg-v2-bg/72" />
      <div className="absolute inset-x-0 bottom-0 flex h-[510px] flex-col rounded-t-3xl bg-scriba-paper ring-1 ring-scriba-hairline">
        {/* Cabeçalho: o nome com o balão de conversa, e o X. */}
        <div className="flex items-center justify-between py-2 pr-2 pl-4">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold leading-none text-scriba-ink-soft">
            <svg {...DRAWER_ICON} className="size-4" role="presentation">
              <path d="M13.5 7.6c0 2.6-2.5 4.7-5.5 4.7-.6 0-1.2-.1-1.7-.2l-3.3 1.4.9-2.6C2.9 10 2.5 8.8 2.5 7.6 2.5 5 5 2.9 8 2.9s5.5 2.1 5.5 4.7Z" />
            </svg>
            Biblo
          </span>
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-full text-scriba-ink-soft"
          >
            <svg {...DRAWER_ICON} className="size-4" role="presentation">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </span>
        </div>

        {/* A conversa, em TRÊS fatias: o cumprimento sozinho, a pergunta com
            o "Pensando…", e a resposta com o trecho sugerido. Uma gaveta
            parada mostra uma conversa que já aconteceu; o que a seção promete
            é perguntar e ser respondido, e isso é a passagem de uma para a
            outra.

            Ela é ancorada EMBAIXO (`justify-end`), e é o detalhe que faz a
            gaveta parecer usada: o que sobra é cortado no TOPO, como numa
            lista rolada até o fim, e não na borda de baixo. É também o que
            mantém as três fatias alinhadas pela ÚLTIMA linha — cada uma tem
            uma altura diferente, e ancoradas pelo topo a conversa inteira
            subiria e desceria a cada troca. Ao editar as falas, confira que o
            trecho sugerido continua visível: ele é a única parte que prova
            "a resposta entra no texto". */}
        <MockSwap className="min-h-0 flex-1 overflow-hidden">
          <BibloTurn />
          <BibloTurn asking>
            <BibloBubble>
              <span className="text-scriba-ink-mute">Pensando…</span>
            </BibloBubble>
          </BibloTurn>
          <BibloTurn asking>
            <BibloBubble>
              Os judeus e samaritanos não se falavam havia séculos, e um homem dirigir a palavra a
              uma mulher sozinha, ao meio-dia, já era estranho por conta própria.
              {/* O trecho sugerido: é o que tira a conversa do bate-papo e a
                  põe no texto, e é por isso que ele aparece aqui. */}
              <span className="mt-3 block rounded-xl border border-dashed border-scriba-hairline p-3">
                <span className="block text-[10.5px] uppercase tracking-wide text-scriba-ink-soft">
                  Parágrafo
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-scriba-ink">
                  Ao pedir água a uma samaritana, Jesus atravessa de uma vez a barreira étnica e a
                  social.
                </span>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-scriba-ink px-3 py-1.5 text-[11.5px] font-medium text-scriba-paper">
                  <svg {...DRAWER_ICON} className="size-3.5" strokeWidth={2} role="presentation">
                    <path d="M8 3.5v9M3.5 8h9" />
                  </svg>
                  Adicionar este parágrafo
                </span>
              </span>
            </BibloBubble>
          </BibloTurn>
        </MockSwap>

        {/* Os chips e o campo. No app os chips saem do CONTEÚDO; aqui são
            fixos, porque num mockup não há resumo de verdade para derivá-los. */}
        <div className="flex flex-col gap-3 border-t border-scriba-hairline px-4 pb-4 pt-3">
          <div className="flex gap-1.5 overflow-hidden">
            {["Onde ficava Samaria", "Outras passagens sobre sede"].map((chip) => (
              <span
                key={chip}
                className="shrink-0 whitespace-nowrap rounded-full border border-scriba-hairline px-3 py-1.5 text-[11.5px] text-scriba-ink-soft"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <span className="flex-1 rounded-2xl bg-scriba-surface px-3.5 py-2.5 text-[13px] leading-6 text-scriba-ink-mute">
              Pergunte sobre a mensagem
            </span>
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-scriba-ink text-scriba-paper"
            >
              <svg {...DRAWER_ICON} className="size-4.5" strokeWidth={2} role="presentation">
                <path d="M8 13V3.5M4 7.2 8 3.2l4 4" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Uma fatia da conversa: o cumprimento de abertura, que está nas três, mais o
 * que aquela fatia acrescenta.
 *
 * O cumprimento é repetido de propósito em vez de ficar fora do `MockSwap`:
 * ele SOBE quando a pergunta chega (a coluna é ancorada embaixo), e uma
 * dissolvência entre duas fatias que o contêm nas duas alturas certas é o que
 * faz a conversa parecer crescer. Fora do palco, ele ficaria pregado no lugar
 * enquanto o resto se mexe.
 *
 * ⚠️ As falas são sobre João 4, a MESMA passagem do `LandingEditorMock` e do
 * `LandingSummaryMock` (os três leem `DEMO_BLOCKS`). Se a demo mudar de sermão,
 * esta conversa muda junto, ou a página mostra um Biblo conversando sobre
 * outra tela.
 */
function BibloTurn({ children, asking }: { children?: React.ReactNode; asking?: boolean }) {
  return (
    <div className="flex h-full flex-col justify-end gap-5 px-4 pb-1">
      <BibloBubble>
        Vi que o resumo fala sobre a mulher samaritana, em João 4. Quer que eu te explique o
        contexto da passagem, ou traga versículos sobre o mesmo assunto?
      </BibloBubble>
      {asking ? (
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-biblo-bubble-me px-3.5 py-2 text-[13px] leading-relaxed text-biblo-bubble-me-ink">
            Por que a mulher samaritana estranhou quando Jesus falou com ela?
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * O balão do Biblo: rosto à esquerda, canto de cima quadrado, superfície
 * elevada. Mesma montagem do `BibloMessage`.
 */
function BibloBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <BibloFace size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-scriba-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  A gravação                                                                */
/* -------------------------------------------------------------------------- */

/**
 * As treze barras da onda: altura cheia em px, qual das três animações e o
 * atraso dela.
 *
 * Treze é `WAVE_BARS` do `useAudioCapture`, e o número importa: com menos a
 * onda deixa de ser uma onda e vira um gráfico de barras. A altura é o TETO de
 * cada uma — o `scaleY` da keyframe encolhe a partir dela —, e o perfil é o de
 * voz: o meio mais alto, que é onde o analisador concentra as bandas graves, e
 * as pontas baixas, sem simetria perfeita, que é o que denuncia desenho em vez
 * de som.
 *
 * **O par `anim` + `delay` é o que faz a fileira não pulsar em bloco.** As três
 * durações (`--animate-lp-wave-*`, em `globals.css`) não são múltiplas entre
 * si, e os atrasos são negativos e diferentes por barra, então nenhuma vizinha
 * sobe junto da outra e o padrão combinado demora muito para se repetir. Com
 * uma duração só e sem atraso, treze barras subindo e descendo à uma são um
 * equalizador de brinquedo.
 *
 * O atraso NEGATIVO também é o que garante que a onda já esteja em movimento
 * no primeiro quadro, em vez de partir toda da altura cheia — mesma razão dos
 * atrasos de `LandingParticles`.
 *
 * O repouso da tela real é 14px em TODAS, parado, com as barras a 15% de
 * opacidade. É o outro estado possível deste mockup, e não é o que a seção
 * promete: ela fala de uma pregação sendo gravada, não de uma tela esperando.
 */
const WAVE_BARS: { h: number; anim: string; delay: number }[] = [
  { h: 16, anim: "var(--animate-lp-wave-b)", delay: -0.6 },
  { h: 28, anim: "var(--animate-lp-wave-a)", delay: -1.9 },
  { h: 22, anim: "var(--animate-lp-wave-c)", delay: -3.0 },
  { h: 48, anim: "var(--animate-lp-wave-a)", delay: -0.9 },
  { h: 74, anim: "var(--animate-lp-wave-b)", delay: -2.4 },
  { h: 58, anim: "var(--animate-lp-wave-c)", delay: -1.3 },
  { h: 96, anim: "var(--animate-lp-wave-a)", delay: -0.4 },
  { h: 64, anim: "var(--animate-lp-wave-b)", delay: -2.8 },
  { h: 80, anim: "var(--animate-lp-wave-c)", delay: -1.6 },
  { h: 40, anim: "var(--animate-lp-wave-a)", delay: -2.1 },
  { h: 26, anim: "var(--animate-lp-wave-b)", delay: -0.8 },
  { h: 34, anim: "var(--animate-lp-wave-c)", delay: -3.4 },
  { h: 18, anim: "var(--animate-lp-wave-a)", delay: -1.5 },
];

/**
 * O relógio da `TopBar` do mockup, contando de verdade.
 *
 * São três fitas de dígito que rolam com `steps()` (ver os
 * `--animate-lp-digit-*` no `globals.css`): a unidade do segundo troca a cada
 * segundo, a dezena a cada dez, a unidade do minuto a cada minuto. O resultado
 * é `0:00` subindo até `9:59` e voltando, sem uma linha de JavaScript.
 *
 * **A dezena do minuto é um zero ESCRITO**, não uma quarta fita: ela mudaria
 * uma vez a cada dez minutos de página aberta, e ninguém está olhando o mockup
 * há dez minutos.
 *
 * `tabular-nums` é o que impede o relógio de tremer, igual ao
 * `RecordingClock`: com dígitos de largura variável, cada troca move o número
 * inteiro alguns pixels.
 */
export function MockClock() {
  return (
    <span
      // O relógio é DECORATIVO aqui: um leitor de tela anunciando um contador
      // que sobe para sempre numa página de venda é ruído, e a informação
      // ("gravando") já está escrita ao lado em texto.
      aria-hidden
      className="flex items-center font-semibold text-[15px] text-scriba-ink-strong tabular-nums leading-none"
    >
      0
      <DigitReel animation="var(--animate-lp-digit-min)" count={10} />
      <span>:</span>
      {/* Seis dígitos, não dez: a dezena do segundo vai de 0 a 5. O `count` e
          o `steps()` da animação são o mesmo número — ver a keyframe
          `lp-digit-roll`. */}
      <DigitReel animation="var(--animate-lp-digit-ten)" count={6} />
      <DigitReel animation="var(--animate-lp-digit-sec)" count={10} />
    </span>
  );
}

/**
 * Uma casa do relógio: `count` dígitos em coluna, cortados na altura de UMA
 * linha.
 *
 * ⚠️ **`count` tem de ser o mesmo número do `steps()` da animação que o move.**
 * A fita sobe a própria altura inteira (`-100%`, ver a keyframe
 * `lp-digit-roll`), então é o número de passos que decide quanto é um dígito:
 * dez passos sobre dez dígitos andam um por vez, seis passos sobre dez andam
 * 1,67 e a casa mostra metade de dois números.
 */
function DigitReel({ animation, count }: { animation: string; count: number }) {
  return (
    // `align-top` no invólucro: um `inline-block` senta na LINHA DE BASE por
    // padrão, e uma caixa de uma linha alinhada assim desce meio dígito em
    // relação aos vizinhos — o relógio ficava com as casas em degrau.
    //
    // A altura é `1lh` (a altura de linha computada), não uma medida em px:
    // ela acompanha a fonte do relógio sem um segundo número para manter em
    // sincronia. `leading-none` nos dois níveis porque com a altura de linha
    // padrão cada dígito mede mais que a janela e o corte mostra meio número.
    <span className="inline-block h-[1lh] overflow-hidden align-top leading-none">
      <span className="block leading-none" style={{ animation }}>
        {Array.from({ length: count }, (_, d) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: o índice É o dígito, e a fita nunca reordena
          <span key={`d-${d}`} className="block h-[1lh] leading-none">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * A tela de gravação dentro do `PhoneFrame`.
 *
 * **É a tela mais silenciosa do produto, e é isso que ela tem a dizer.** Uma
 * onda, um relógio e três botões: durante a pregação não há cartão aparecendo,
 * nada para ler, nada para tocar. A landing mostrava só o resultado (o resumo),
 * e o resultado não conta o que a pessoa faz durante a uma hora de sermão —
 * que é guardar o aparelho.
 *
 * Reproduzido à mão, como os outros mocks (ver o cabeçalho deste arquivo): o
 * `AudioStudio` é `"use client"`, pede microfone, IndexedDB e um analisador de
 * áudio. O que veio de lá sem tradução são as medidas e os tokens — barras de
 * 14px de largura com 8px de vão, o disco grande de 96px entre dois de 56px,
 * `--v2-wave` na onda e `--v2-card` nos botões —, então repintar a tela
 * repinta a landing.
 */
export function LandingRecordingMock() {
  return (
    // A tela real é uma coluna que ocupa a ALTURA TODA, com a onda centrada e
    // os controles no rodapé. Reproduzir isso aqui exige a altura escrita: o
    // `PhoneFrame` põe os filhos num `div` com `pt-[108px]` e sem altura
    // própria, então um `h-full` resolve para `auto` e os três botões sobem e
    // colam na onda, com meio aparelho vazio embaixo.
    //
    // A conta é a tela do mockup (`h-[680px]` no `phone-mask`) menos o vão do
    // cabeçalho. **Se uma das duas medidas mudar no `PhoneFrame`, esta muda
    // junto** — é o preço de a única tela do produto que ocupa a altura inteira
    // ser desenhada dentro de um invólucro que rola.
    <div className="flex h-[calc(680px-108px)] flex-col items-center px-6 pb-9">
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <div aria-hidden className="flex h-[168px] items-center justify-center gap-2">
          {WAVE_BARS.map((bar, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: as barras são posições fixas, não dados
              key={`bar-${i}`}
              className="w-3.5 rounded-full bg-v2-wave opacity-50"
              style={{
                height: `${bar.h}px`,
                animation: bar.anim,
                animationDelay: `${bar.delay}s`,
              }}
            />
          ))}
        </div>
      </div>
      {/* Os três controles: pausar, parar, apagar. O do meio é o dobro dos
          outros, e é o único que a pessoa procura no meio de um culto. */}
      <div className="flex items-center justify-center gap-6">
        <span
          aria-hidden
          className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" role="presentation">
            <rect x="5" y="4" width="3.4" height="12" rx="1.2" />
            <rect x="11.6" y="4" width="3.4" height="12" rx="1.2" />
          </svg>
        </span>
        <span
          aria-hidden
          className="inline-flex size-24 items-center justify-center rounded-full bg-v2-card text-v2-ink"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" role="presentation">
            <rect x="6" y="6" width="20" height="20" rx="3" />
          </svg>
        </span>
        <span
          aria-hidden
          className="inline-flex size-14 items-center justify-center rounded-full bg-v2-card text-v2-ink-mute"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="presentation"
          >
            <path d="M3.8 6h12.4M8 6V4.4h4V6M5.4 6l.8 9.6h7.6L14.6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  A importação do YouTube                                                   */
/* -------------------------------------------------------------------------- */

/** O quadrado do YouTube, na pastilha do CTA. O mesmo das duas telas. */
function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      role="presentation"
      className={className}
    >
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.2 22 12 22 12s0-3.2-.4-4.8ZM9.9 15.1V8.9l5.4 3.1-5.4 3.1Z" />
    </svg>
  );
}

/**
 * A tela de `/importar` dentro do `PhoneFrame`: o link colado e o botão.
 *
 * **O RECORTE ("do minuto 12 ao 45") não aparece aqui, e a ausência é
 * deliberada.** Ele é uma resposta para quem já entendeu o que a importação
 * faz, e na landing ele responde uma pergunta que ninguém fez ainda: o que esta
 * seção precisa provar é que um link vira resumo. Já esteve nesta tela e saiu
 * por isso — não o traga de volta sem pedido.
 *
 * Reproduzido à mão pela razão do cabeçalho deste arquivo: o `YoutubeUrlForm`
 * é `"use client"` e traz consigo a validação, o saldo e o `lucide-react`. O
 * que veio de lá são as medidas, os tokens e os textos exatos, a começar pelo
 * rótulo "Link do vídeo".
 *
 * ⚠️ O botão NÃO traz preço, e o `COIN_COSTS.youtubeImport` que morava neste
 * arquivo saiu com ele: nenhuma das quatro seções da LP fala em moedas hoje
 * (ver o `cost` de cada `Capability`), e uma tela de mockup não é o lugar de
 * reabrir esse assunto sozinha.
 */
export function LandingYoutubeMock() {
  return (
    <div className="flex flex-col gap-8 px-5 pt-20">
      {/* O cabeçalho da tela: o quadrado do YouTube na pastilha do CTA, o
          título e a promessa. */}
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-[image:var(--scriba-cta)] text-scriba-cta-ink"
        >
          <YoutubeGlyph />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-heading text-[19px] font-semibold leading-tight tracking-tight text-scriba-ink-strong">
            Importar do YouTube
          </span>
          <span className="text-pretty text-[12px] font-light leading-relaxed text-scriba-ink-soft">
            O Scriba entende o conteúdo do vídeo e monta um resumo organizado em segundos.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[12px] font-medium text-scriba-ink">Link do vídeo</span>
        {/* O campo com um link DENTRO, não o `placeholder`: um campo vazio
            deixa a tela no estado "nada aconteceu ainda", e o que o mockup
            precisa mostrar é o gesto já feito. */}
        <span className="w-full truncate rounded-2xl border border-scriba-hairline bg-scriba-paper px-3.5 py-3 text-[12.5px] text-scriba-ink">
          youtube.com/watch?v=aX3p1Kd9
        </span>

        {/* O botão. Ele é a única coisa da tela que COBRA, e é por isso que o
            mockup para aqui: a fatia seguinte é o que acontece depois de ele
            ser tocado. */}
        <span className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--scriba-cta)] px-6 py-3 text-[14px] font-semibold text-scriba-cta-ink">
          <YoutubeGlyph className="size-4" />
          Importar
        </span>
      </div>
    </div>
  );
}

/**
 * A ESPERA da importação: a mesma tela de `/importar/[id]`, com a etapa em que
 * o Scriba já está escrevendo.
 *
 * É a fatia do meio da seção, e é a que responde "o que acontece depois que eu
 * colo o link?". Sem ela a seção mostraria um formulário e um resumo, e a parte
 * que a pessoa quer saber — que o trabalho é do Scriba e não dela — ficaria
 * entre as duas telas, sem tela nenhuma.
 *
 * **A miniatura é um lugar, não uma foto.** Na tela de verdade ela vem do id do
 * vídeo (`youtubeThumbnailUrl`), e aqui nenhuma imagem podia entrar: seria uma
 * requisição a um domínio de terceiro na única rota que um visitante anônimo
 * carrega inteira, e por um vídeo que não existe. O retângulo com o botão de
 * play diz a mesma coisa sem pedir rede.
 *
 * ⚠️ A frase da etapa é uma das do `STEPS` do `YoutubeImport`, e os cinco
 * pontos são as cinco etapas dele. Ganhou ou perdeu etapa lá? Os pontos mudam
 * junto, ou a landing promete uma espera com outro tamanho.
 */
export function LandingYoutubeImportingMock() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 pt-12 text-center">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-[image:var(--scriba-cta)] text-scriba-cta-ink"
      >
        <YoutubeGlyph />
      </span>

      <span className="font-heading text-[17px] font-semibold text-scriba-ink">
        Importando do YouTube
      </span>

      <span className="flex aspect-video w-full max-w-[260px] items-center justify-center rounded-2xl bg-scriba-surface ring-1 ring-scriba-hairline ring-inset">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-scriba-ink-mute/25 text-scriba-paper"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" role="presentation">
            <path d="M5.5 3.4 12 8l-6.5 4.6V3.4Z" />
          </svg>
        </span>
      </span>

      <span className="text-[13px] font-medium text-scriba-ink">A sede que só Cristo cura</span>

      <span className="text-[14px] font-light text-scriba-ink-soft">
        Organizando a mensagem em tópicos…
      </span>

      {/* As cinco etapas do `STEPS`, com as três primeiras cumpridas. */}
      <span aria-hidden className="flex items-center gap-1.5">
        {[true, true, true, false, false].map((done, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: são as cinco etapas fixas do `STEPS`, não dados
            key={`step-${index}`}
            className={cn(
              "block size-1.5 rounded-full",
              done ? "bg-scriba-blue" : "bg-scriba-ink-mute/25"
            )}
          />
        ))}
      </span>

      <span className="text-[12px] font-light leading-relaxed text-scriba-ink-mute">
        Isso leva alguns minutos numa pregação longa. Pode deixar a tela aberta.
      </span>
    </div>
  );
}
