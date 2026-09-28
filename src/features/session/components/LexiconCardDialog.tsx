"use client";

import { ArrowLeft, Loader2, MoreVertical, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LexiconNavProvider } from "@/features/session/components/LexiconProvider";
import { LexiconReportDialog } from "@/features/session/components/LexiconReportDialog";
import { RichText } from "@/features/session/components/RichText";
import { useLexiconCard } from "@/features/session/lexicon-query";
import { LEXICON_CATEGORY_LABEL } from "@/lib/domain/lexicon";
import { toParagraphs } from "@/lib/domain/paragraphs";

/**
 * O cartão de um nome: quem foi, onde fica, o que escreveu.
 *
 * Irmão do `ChapterDialog`, e deliberadamente parecido com ele: os dois abrem a
 * partir de uma palavra do parágrafo e os dois mostram algo que NÓS temos, não
 * algo que um modelo escreveu na hora. Lá é a NVI em disco; aqui é o que o
 * admin cadastrou em `lexicon_entries`. Em nenhum dos dois o modelo tem a
 * caneta.
 *
 * ## A imagem é um BANNER 21/9, abaixo do título e da categoria
 *
 *     Paulo, o apóstolo dos gentios
 *     Personagem bíblico
 *     ┌──────────────────────────────────┐
 *     │            [ 21 / 9 ]            │
 *     └──────────────────────────────────┘
 *     Judeu nascido em Tarso, na Cilícia…
 *
 * **Ela já foi faixa, depois retrato de 56px no cabeçalho, e voltou a ser
 * faixa.** As duas primeiras vidas saíram pelo mesmo motivo: o léxico guardava
 * as DUAS formas — o retrato de um personagem é alto, o mapa de uma rota é
 * deitado —, e nenhuma caixa serve às duas. Contida, ela deixava sobras de
 * fundo dos lados; cortada, comia a cabeça de quem ela deveria mostrar. O
 * retrato do cabeçalho foi a saída de então: pequeno o bastante para a forma da
 * imagem não importar.
 *
 * **O que mudou não foi a opinião, foi o INSUMO.** A imagem do cadastro passou
 * a ser 21/9, escolhida e recortada por quem escreve o cartão. Com uma
 * proporção só, a caixa pode ser dessa proporção, e a objeção de origem
 * simplesmente não tem mais sujeito.
 *
 * **`object-cover`, e é deliberado.** Um banner que não preenche a própria
 * faixa não é um banner, é uma imagem com tarjas. Com o insumo em 21/9 o corte
 * é nulo; a consequência a dizer em voz alta é que as entradas ANTIGAS, com
 * retrato em pé, aparecem cortadas aqui — o conserto delas é subir a arte na
 * proporção nova, não devolver o `contain`, que traria de volta as sobras para
 * o caso que passou a ser a regra.
 *
 * **21/9 e não 16/9**: é a faixa mais rasa que ainda lê como imagem, e a
 * objeção antiga contra a capa de artigo continua de pé — quem tocou num nome
 * tocou para LER sobre ele, e cada pixel de banner empurra a resposta para
 * baixo da dobra. Num diálogo de 512px ela custa ~220px; em 16/9 custaria 288.
 *
 * **Sem imagem o cartão não fica com um buraco**: a faixa simplesmente não
 * existe e o texto encosta na categoria. Imagem é opcional no cadastro de
 * propósito (ver `canPublishLexiconEntry`), então "sem foto" é um estado comum,
 * não uma falha a ser desenhada com um ícone de imagem quebrada. Pela mesma
 * razão ela não tem chão cinza atrás e não é esqueleto enquanto carrega: ela
 * mora no ramo do `data`, e reservar a faixa antes de saber se há imagem seria
 * desenhar o buraco para as entradas que não têm.
 *
 * `next/image` e nunca `<object>`/`<iframe>`: o bucket aceita SVG, e SVG só é
 * inerte enquanto for desenhado como imagem. Ver a migração 0064.
 *
 * ## O texto PASSA pelo `RichText`, e o cartão navega DENTRO DE SI
 *
 * Este cabeçalho dizia o contrário, com dois argumentos. O segundo ("é uma nota
 * curta, não um texto para navegar") não sobreviveu ao conteúdo real: um cartão
 * de personagem cita meia dúzia de outros nomes do léxico e uma dúzia de
 * referências bíblicas, e todas ficavam mortas no meio da prosa — inclusive as
 * referências, que são o caminho mais curto para a Bíblia dentro de um texto
 * que fala dela o tempo todo.
 *
 * O primeiro argumento era real: um nome dentro do cartão abriria OUTRO cartão
 * por cima deste, e não haveria caminho de volta. A saída não é deixar o texto
 * morto, é o cartão navegar dentro de si mesmo — a trilha abaixo troca o
 * conteúdo do MESMO diálogo e desenha um voltar. Tocar em "Paulo" dentro do
 * Timóteo leva ao Paulo; o voltar traz de volta ao Timóteo.
 *
 * **E o próprio nome não é marcado**, o que o `LexiconNav.self` resolve: um
 * cartão do Timóteo que sublinha "Timóteo" oferece um caminho para onde a
 * pessoa já está.
 *
 * A referência bíblica continua abrindo o `ChapterDialog`, por cima. São duas
 * caixas empilhadas, e aqui isso é aceitável porque a de cima é uma FOLHA: ela
 * mostra o texto e fecha, sem oferecer um terceiro salto.
 *
 * ## "Algo está errado" fica atrás dos três pontinhos
 *
 * O conteúdo daqui é escrito à mão, o que significa que ele erra como gente
 * erra: uma data trocada, o Timóteo errado, uma frase que ficou pela metade.
 * Quem lê é quem descobre, e sem um caminho de volta esse achado morre na tela.
 *
 * **No menu, e não como botão à vista**, porque a proporção manda: reportar um
 * erro é raro e ler é o tempo todo. Um "algo está errado" permanente no cabeçalho
 * de um cartão de três parágrafos sugere que o texto é pouco confiável, que é o
 * contrário do que ele é. É o mesmo lugar que o resumo já usa (`SessionMenu`),
 * então o gesto é o que a pessoa já aprendeu.
 *
 * **Ele fecha o cartão antes de abrir a janela do alerta.** Seria a terceira
 * caixa empilhada (cartão → alerta, com o `ChapterDialog` podendo entrar por
 * cima), e três camadas sobre a mesma superfície é onde o véu desiste. Além
 * disso, quem vai escrever o que está errado já leu o que precisava ler.
 */

export function LexiconCardDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /**
   * A trilha de nomes abertos, do primeiro ao atual.
   *
   * É uma pilha, e não um "slug atual", porque o voltar precisa saber de ONDE
   * se veio: com três saltos (Timóteo → Paulo → Éfeso), um estado simples
   * devolveria ao começo em vez do passo anterior.
   */
  const [trail, setTrail] = useState<string[]>([slug]);
  const current = trail[trail.length - 1];

  // Reabrir o diálogo num nome diferente recomeça a trilha. Sem isto, tocar em
  // "Paulo" no parágrafo depois de ter navegado por dentro traria a trilha
  // antiga junto, com um voltar apontando para um nome que ninguém abriu.
  useEffect(() => {
    if (open) setTrail([slug]);
  }, [open, slug]);

  const { data, isPending, isError } = useLexiconCard(current);
  const canGoBack = trail.length > 1;

  /**
   * O alerta é irmão do cartão, não filho: ele abre DEPOIS que o cartão fecha.
   *
   * Por isso o slug e o termo são guardados aqui em vez de lidos do `data` — no
   * instante em que a janela abre, o cartão já se foi e `data` mudou com ele.
   */
  const [reporting, setReporting] = useState<{ slug: string; term: string } | null>(null);

  return (
    <>
      {/* IRMÃ do cartão, nunca filha: tocar em "Algo está errado" fecha o
          cartão e abre esta janela, e como filha ela seria desmontada no mesmo
          quadro em que deveria aparecer. */}
      {reporting ? (
        <LexiconReportDialog
          slug={reporting.slug}
          term={reporting.term}
          open
          onOpenChange={(o) => {
            if (!o) setReporting(null);
          }}
        />
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Mais largo que o padrão do diálogo (`sm:max-w-sm`) SÓ no desktop: o
          cartão é um texto de três ou quatro parágrafos, e em 384px ele vira
          uma coluna estreita e comprida que obriga a rolar para ler uma nota
          curta. No celular nada muda — lá a largura já é a da tela menos a
          margem, e o teto não chega a valer. `lg` e não mais: a medida de linha
          continua sendo o limite, e passando disso o olho perde o começo da
          linha seguinte (a mesma razão do `max-w-3xl` das telas de leitura). */}
        <DialogContent className="sm:max-w-lg">
          {/* `pb-4` fecha o cabeçalho com a mesma folga que o `pt-4` do
            componente abre. Sem ele, quem separava o retrato da descrição era só
            o `pt-4` do corpo, e a metade de cima da linha ficava mais apertada
            que a de baixo — num cabeçalho de 56px, que é bem mais alto que o
            texto solto para o qual aquele padding foi calibrado, a diferença se
            vê. */}
          {/* `pr-20` e não `pr-12`: o canto de cima à direita agora tem DOIS
            controles, o X do diálogo e os três pontinhos ao lado dele. Com o
            recuo antigo, um título longo passava por baixo do menu. */}
          <DialogHeader className="flex-row items-center gap-3 pr-20 pb-4">
            {canGoBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Voltar"
                className="-ml-1 shrink-0"
                onClick={() => setTrail((t) => t.slice(0, -1))}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            {/* `min-w-0` é o que deixa um título longo QUEBRAR em vez de esticar a
              linha: um filho de flex adota a largura mínima do conteúdo, e sem
              isto "Nabucodonosor, rei da Babilônia" empurraria a caixa. */}
            <div className="flex min-w-0 flex-col gap-1">
              {/* `leading-snug` sobre o `leading-none` do componente: um título
                de duas linhas com entrelinha zerada tem os glifos de uma
                encostando nos da outra. */}
              {/* O giro mora NO TÍTULO, e a categoria só aparece quando chega.
                Antes a linha de baixo dizia "Carregando" enquanto as tarjas de
                esqueleto já diziam a mesma coisa logo abaixo, e o texto ainda
                empurrava a categoria para dentro do cartão: o aviso aparecia
                duas vezes e sumia trocado por outra palavra. */}
              {/* `text-lg` sobre o `text-base` do componente, e `text-xs` na
                categoria logo abaixo: o par abre o cartão, e com os dois a um
                degrau de distância (16 e 14) a categoria disputava com o nome
                em vez de apoiá-lo. Afastando para 18 e 12, o nome vira o título
                que ele é e a categoria vira a etiqueta que ela é — a hierarquia
                passa a ser lida antes de qualquer palavra. */}
              <DialogTitle className="flex items-center gap-2 text-lg leading-snug">
                <span className="min-w-0">{data?.title ?? current}</span>
                {isPending ? (
                  <Loader2
                    aria-hidden
                    className="size-4 shrink-0 animate-spin text-scriba-ink-mute"
                  />
                ) : null}
              </DialogTitle>
              {/* O `DialogDescription` não pode simplesmente sumir: o diálogo o
                aponta por `aria-describedby`, e um alvo inexistente é lido como
                descrição vazia. Enquanto carrega ele fica só para o leitor de
                tela. */}
              <DialogDescription className={data ? "text-xs" : "sr-only"}>
                {data ? LEXICON_CATEGORY_LABEL[data.category] : "Carregando o verbete"}
              </DialogDescription>
            </div>

            {/* Só quando há cartão: um menu sobre um esqueleto de carregamento
              oferece reportar um erro num texto que ainda não foi lido. */}
            {data ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Mais opções"
                  className="absolute top-2 right-11 flex size-8 items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => {
                      // Fecha o cartão e abre o alerta. Ver o cabeçalho.
                      setReporting({ slug: data.slug, term: data.title });
                      onOpenChange(false);
                    }}
                  >
                    <TriangleAlert className="size-4" />
                    Algo está errado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </DialogHeader>

          <div className="min-h-16">
            {isPending ? (
              <div aria-hidden className="flex flex-col gap-2">
                {["w-full", "w-[94%]", "w-[88%]"].map((w, i) => (
                  <span
                    key={w}
                    className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${w}`}
                    style={{ animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-destructive">Não consegui carregar agora.</p>
            ) : data ? (
              <LexiconNavProvider
                nav={{ self: data.slug, go: (next) => setTrail((t) => [...t, next]) }}
              >
                {/* O BANNER, abaixo do título e da categoria e acima do texto.
                  Ver o cabeçalho: a proporção é 21/9 porque é a que o cadastro
                  entrega, e `object-cover` porque um banner que não preenche a
                  própria faixa não é um banner.

                  Ele mora AQUI dentro, no ramo do `data`, e não no cabeçalho:
                  enquanto carrega, o corpo inteiro é esqueleto, e uma faixa
                  reservada lá em cima seria um buraco para as entradas que não
                  têm imagem — que continuam sendo um estado comum, não uma
                  falha (ver `canPublishLexiconEntry`). */}
                {data.imageUrl ? (
                  <div className="relative mb-4 aspect-[21/9] w-full overflow-hidden rounded-xl">
                    <Image
                      src={data.imageUrl}
                      alt=""
                      fill
                      // A largura do diálogo: a tela menos a margem no celular,
                      // 512px (`sm:max-w-lg`) do `sm` para cima.
                      sizes="(max-width: 640px) 92vw, 512px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                {/* Um `<p>` por parágrafo, e não um `whitespace-pre-line` sobre
                  o texto inteiro: o `RichText` precisa de uma string por
                  parágrafo para marcar referência e nome próprio dentro de cada
                  uma.

                  **Quem reparte é o `toParagraphs`, e não um `split` daqui.**
                  Ele fazia `split(/\n{2,}/)`, o que exigia linha EM BRANCO
                  entre as ideias: quem escreveu a descrição no painel apertando
                  Enter uma vez só via o cartão inteiro grudado num bloco de
                  cinza, sem nada na tela explicando por quê. E a descrição
                  digitada de um fôlego, sem quebra nenhuma, continuava parede
                  mesmo com o `split` certo — é o `splitWall` que a reparte em
                  fronteira de frase, o MESMO que já põe respiro na resposta do
                  Biblo. Ver `lib/domain/paragraphs.ts`. */}
                <div className="flex flex-col gap-4">
                  {toParagraphs(data.description).map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 48)}
                      className="text-pretty text-sm leading-relaxed text-scriba-ink"
                    >
                      <RichText>{paragraph}</RichText>
                    </p>
                  ))}
                </div>
              </LexiconNavProvider>
            ) : (
              // A entrada sumiu do cadastro entre o índice descer e o toque
              // acontecer. Raro, e ainda assim possível: o índice vive até um
              // minuto em memória (ver `getLexiconIndex`).
              <p className="text-sm text-muted-foreground">Ainda não escrevi sobre isso.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
