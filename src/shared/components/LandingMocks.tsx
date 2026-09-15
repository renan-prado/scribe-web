import { BlockRenderer, blockKey } from "@/features/session/components/BlockRenderer";
import { LeadIdea } from "@/features/session/components/LeadIdea";
import type { SummaryBlock } from "@/lib/domain/summary";

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

/**
 * Os mesmos blocos, sem o título e o parágrafo de abertura.
 *
 * É o que o hero mostra. Lá o mockup aparece CORTADO, uns 600px de tela, e na
 * ordem completa a frase marcante começa a 584px: a única cor do resumo caía
 * bem na borda do corte, ou fora dele. Tirando os dois blocos entre a ideia
 * central e o `highlight`, o amarelo sobe para o meio do que está visível.
 *
 * `slice(2)` e não um filtro por tipo: o corte é POSICIONAL, "os dois
 * primeiros blocos", e um filtro por `type` levaria junto o outro `h1`/
 * parágrafo se a demo crescer.
 *
 * Só o hero usa isto. A seção "O resumo" mostra a ordem inteira, que é a
 * ordem de verdade.
 */
const HERO_BLOCKS: SummaryBlock[] = DEMO_BLOCKS.slice(2);

type LandingSummaryMockProps = {
  /** `true` no hero, onde o corte manda. Ver `HERO_BLOCKS`. */
  lead?: boolean;
};

export function LandingSummaryMock({ lead = false }: LandingSummaryMockProps) {
  const blocks = lead ? HERO_BLOCKS : DEMO_BLOCKS;
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-3">
      <div className="flex flex-col gap-7">
        {/* O componente DE VERDADE, e não uma cópia do desenho dele. Esta é a
            exceção à regra do cabeçalho, pelo mesmo motivo do `BlockRenderer`:
            a abertura de uma leitura tem um desenho só no produto (ver
            `LeadIdea`), e reproduzi-lo à mão aqui foi o que deixou a landing
            mostrando a estética anterior depois de a do app mudar. Ele é
            servidor puro e não arrasta bundle. */}
        <LeadIdea label="Ideia central" text={DEMO_SHORT_SUMMARY} />
        {/* `blockKey` já é único nesta lista fixa (os textos são todos
            distintos), então não precisa do índice para desempatar. */}
        {/* Um bloco por linha, ocupando a tela inteira do aparelho.

            Aqui já houve uma coluna de conteúdo ao lado de um espaçador de
            36px, sobra para o botão de ação que cada bloco tem no app de
            verdade. No mockup não há botão nenhum, e o espaçador era
            `hidden sm:block`: uma media query de VIEWPORT dentro de um
            telefone que mede 390px em qualquer tela. No celular ele sumia e
            estava tudo certo; do `sm` para cima ele comia 52px (36 + o gap)
            só do lado direito, então todo bloco centrado, a frase marcante
            inclusive, ficava 26px à esquerda do meio da tela, e mais estreito
            do que precisava. Parecia desalinhado e espremido, e era. */}
        {blocks.map((block) => (
          <div key={`${block.type}-${blockKey(block)}`} className="animate-content-fade min-w-0">
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>
    </div>
  );
}
