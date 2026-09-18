"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { requestLexiconCard } from "@/features/session/lib/api";

/**
 * O retrato de um nome do léxico, dentro da conversa.
 *
 * ## Por que é só a IMAGEM, e não o cartão inteiro
 *
 * O cartão tem três partes: imagem, título e descrição. As duas últimas o Biblo
 * já entregou em PROSA — a descrição entrou no prompt como fonte, e a resposta
 * que a pessoa acabou de ler foi escrita a partir dela. Desenhar o cartão
 * embaixo dessa resposta seria dizer a mesma coisa duas vezes, uma em voz de
 * conversa e outra em voz de ficha, e a segunda leitura não acrescenta nada.
 *
 * A imagem é a única parte que a prosa não carrega. Um retrato de Habacuque ou
 * um mapa do Mar Vermelho é o que uma resposta de texto nunca vai dar, e é por
 * isso que ele é a única parte que sobe para a tela.
 *
 * ## Ela é pequena, fica ANTES do texto, e não é cortada
 *
 * Ocupa uma faixa estreita no topo do balão, não o corpo dele: a resposta
 * continua sendo o conteúdo, e a imagem é o rosto dela. Uma foto do tamanho do
 * diálogo transformaria a conversa numa galeria com legendas.
 *
 * **A faixa tem altura fixa e `object-contain`**, pela mesma razão do cartão
 * (ver `LexiconCardDialog`), e aqui o erro era pior: ela era 21/9 com
 * `object-cover`, uma fresta deitada sobre um retrato em pé. Do rosto de Paulo
 * sobrava a barba.
 *
 * ## O carregamento não desenha esqueleto
 *
 * Diferente do `LexiconCardDialog`, aqui não há nada esperando: a resposta já
 * está na tela e é o que a pessoa veio ler. Uma faixa cinza pulsando em cima
 * dela anunciaria que falta algo, quando não falta — a imagem é um acréscimo.
 * Ela simplesmente aparece quando chega, e se não chegar, ninguém soube que ela
 * existia.
 *
 * O cache é o mesmo do diálogo (chave `["lexicon-card", slug]`), então tocar no
 * nome depois de já ter visto o retrato abre o cartão sem nova busca.
 */
export function BibloEntityImage({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ["lexicon-card", slug] as const,
    queryFn: () => requestLexiconCard(slug),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
  });

  if (!data?.imageUrl) return null;

  return (
    <figure className="mb-2.5 overflow-hidden rounded-xl bg-muted">
      <div className="relative h-36 w-full">
        <Image
          src={data.imageUrl}
          alt=""
          fill
          sizes="(max-width: 480px) 90vw, 24rem"
          className="object-contain"
        />
      </div>
      {/* O nome sob a imagem, e não um título: quem lê já sabe do que se está
          falando (acabou de perguntar), e o que a legenda responde é "de quem é
          esta foto". */}
      <figcaption className="px-3 py-1.5 text-[11px] text-scriba-ink-mute">{data.term}</figcaption>
    </figure>
  );
}
