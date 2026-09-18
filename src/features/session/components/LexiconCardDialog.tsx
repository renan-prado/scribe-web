"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLexiconCard } from "@/features/session/lexicon-query";
import { LEXICON_CATEGORY_LABEL } from "@/lib/domain/lexicon";

/**
 * O cartão de um nome: quem foi, onde fica, o que escreveu.
 *
 * Irmão do `ChapterDialog`, e deliberadamente parecido com ele: os dois abrem a
 * partir de uma palavra do parágrafo e os dois mostram algo que NÓS temos, não
 * algo que um modelo escreveu na hora. Lá é a NVI em disco; aqui é o que o
 * admin cadastrou em `lexicon_entries`. Em nenhum dos dois o modelo tem a
 * caneta.
 *
 * ## A imagem é o RETRATO do cabeçalho, não uma faixa
 *
 * Ela fica à esquerda do título, na altura dele, e a descrição corre embaixo na
 * largura inteira:
 *
 *     [img]  Paulo, o apóstolo dos gentios
 *     [   ]  Personagem bíblico
 *     ------------------------------------
 *     Judeu nascido em Tarso, na Cilícia…
 *
 * **Ela já foi uma faixa da largura toda, e duas vezes.** Primeiro em 16/9 com
 * `object-cover`, depois contida em 208px, depois em 104px — e o problema nunca
 * foi a altura, era o PAPEL. Uma faixa acima do título é a capa de um artigo, e
 * anuncia que a imagem é o conteúdo; aqui o conteúdo é o texto. Quem tocou num
 * nome tocou para LER sobre ele, e cada pixel de faixa empurrava a resposta para
 * baixo da dobra.
 *
 * No cabeçalho ela vira o que de fato é: a cara da entrada, do lado do nome
 * dela, como a pastilha de iniciais do `EntityCombobox` é a cara de um
 * pregador. Custa 56px de uma linha que já existia.
 *
 * **`object-contain`, e isso não mudou.** O léxico guarda as duas formas — o
 * retrato de um personagem é alto, o mapa de uma rota é deitado —, e um quadrado
 * que corte serve mal às duas.
 *
 * **O que sumiu foi o chão cinza atrás dela.** Contido, o quadrado quase nunca
 * é preenchido pela imagem, e o `bg-muted` desenhava as sobras: uma caixa clara
 * em volta de um retrato, no canto de um diálogo que não tem nenhuma outra
 * caixa. Sem ele, o que aparece ao lado do título é a arte e mais nada.
 *
 * **Sem imagem o cabeçalho não fica com um buraco**: o quadrado simplesmente não
 * existe e o título encosta na esquerda. Imagem é opcional no cadastro de
 * propósito (ver `canPublishLexiconEntry`), então "sem foto" é um estado comum,
 * não uma falha a ser desenhada com um ícone de imagem quebrada.
 *
 * `next/image` e nunca `<object>`/`<iframe>`: o bucket aceita SVG, e SVG só é
 * inerte enquanto for desenhado como imagem. Ver a migração 0064.
 *
 * ## O texto NÃO passa pelo `RichText`
 *
 * Seria a tentação óbvia (a descrição de "Abraão" cita "Gênesis 12"), e está
 * errada por dois motivos. O primeiro é circular: um nome dentro do cartão
 * abriria outro cartão por cima deste, e não há caminho de volta. O segundo é
 * que o cartão é uma nota curta, não um segundo texto para navegar — quem quer
 * ir mais fundo tem o Biblo, que já lê esta mesma descrição.
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
  const { data, isPending, isError } = useLexiconCard(slug);

  return (
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
        <DialogHeader className="flex-row items-center gap-3 pr-12 pb-4">
          {data?.imageUrl ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={data.imageUrl}
                alt=""
                fill
                // 56px na tela, e o dobro numa tela retina: pedir a imagem
                // inteira seria baixar um arquivo grande para desenhá-lo do
                // tamanho de um avatar.
                sizes="56px"
                className="object-contain"
              />
            </div>
          ) : null}
          {/* `min-w-0` é o que deixa um título longo QUEBRAR em vez de esticar a
              linha: um filho de flex adota a largura mínima do conteúdo, e sem
              isto "Nabucodonosor, rei da Babilônia" empurraria a caixa. */}
          <div className="flex min-w-0 flex-col gap-1">
            {/* `leading-snug` sobre o `leading-none` do componente: ao lado da
                imagem a coluna é estreita, e um título de duas linhas com
                entrelinha zerada tem os glifos de uma encostando nos da outra. */}
            <DialogTitle className="leading-snug">{data?.title ?? slug}</DialogTitle>
            <DialogDescription>
              {data ? LEXICON_CATEGORY_LABEL[data.category] : "Carregando"}
            </DialogDescription>
          </div>
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
            <p className="whitespace-pre-line text-sm leading-relaxed text-scriba-ink">
              {data.description}
            </p>
          ) : (
            // A entrada sumiu do cadastro entre o índice descer e o toque
            // acontecer. Raro, e ainda assim possível: o índice vive até um
            // minuto em memória (ver `getLexiconIndex`).
            <p className="text-sm text-muted-foreground">Ainda não escrevi sobre isso.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
