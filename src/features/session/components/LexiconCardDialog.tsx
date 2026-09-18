"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestLexiconCard } from "@/features/session/lib/api";
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
 * ## A imagem vem PRIMEIRO, e é do tamanho que é
 *
 * Um cartão de "Mar Vermelho" com três linhas de texto e um mapa de 40px é um
 * mapa que ninguém olha. A faixa do topo ocupa a largura inteira numa
 * proporção 16/9, que é a que serve tanto para uma pintura de personagem
 * quanto para um mapa deitado, e o texto começa embaixo dela.
 *
 * **Sem imagem o cartão não fica com um buraco**: a faixa simplesmente não
 * existe, e o título sobe para o topo. Imagem é opcional no cadastro de
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

/**
 * O conteúdo do cartão praticamente não muda, e quando muda é porque o admin
 * mexeu nele. `staleTime` infinito, como o texto bíblico: reabrir o mesmo nome
 * duas vezes na mesma sessão não repete a busca.
 */
function useLexiconCard(slug: string) {
  return useQuery({
    queryKey: ["lexicon-card", slug] as const,
    queryFn: () => requestLexiconCard(slug),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
  });
}

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
      <DialogContent>
        {data?.imageUrl ? (
          <div className="relative -mt-2 aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Image
              src={data.imageUrl}
              alt=""
              fill
              // O diálogo não passa de ~28rem; pedir a imagem inteira seria
              // baixar um arquivo grande para desenhá-lo pequeno.
              sizes="(max-width: 480px) 100vw, 28rem"
              className="object-cover"
            />
          </div>
        ) : null}

        <DialogHeader>
          <DialogTitle>{data?.title ?? slug}</DialogTitle>
          <DialogDescription>
            {data ? LEXICON_CATEGORY_LABEL[data.category] : "Carregando"}
          </DialogDescription>
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
