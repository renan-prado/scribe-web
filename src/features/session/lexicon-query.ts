"use client";

import { useQuery } from "@tanstack/react-query";
import { requestLexiconCard } from "@/features/session/lib/api";
import { LEXICON_INDEX_STALE_MS } from "@/lib/domain/lexicon";

/**
 * O cartão de um nome, no lado do cliente.
 *
 * Mora aqui, e não dentro de cada tela, porque são DUAS que o pedem — o diálogo
 * que abre ao tocar num nome do resumo e o retrato que acompanha uma resposta
 * do Biblo — e as duas precisam da mesma entrada de cache. Cada uma com a sua
 * cópia da query significaria, no melhor caso, duas buscas para a mesma coisa;
 * no pior, o que de fato aconteceu: uma divergir da outra num ajuste de
 * frescor.
 *
 * ## `staleTime` não é infinito, e a diferença custou uma imagem errada na tela
 *
 * Ele foi, copiado do padrão da PASSAGEM BÍBLICA, onde `Infinity` é a verdade
 * literal: "João 3:16" na NVI não muda, e reabrir a mesma passagem não deve
 * repetir a busca nunca.
 *
 * Um cartão do léxico não é isso. Ele é conteúdo EDITÁVEL, e a pessoa que o
 * edita é a mesma que vai conferir o resultado. O sintoma foi exatamente esse:
 * trocar a imagem de Jerusalém no painel e continuar vendo a antiga no cartão,
 * porque a entrada de cache dizia que aquilo nunca envelhece. O nome do arquivo
 * carrega carimbo de tempo justamente para a URL nova furar todo cache de HTTP
 * — e não adiantava nada, porque quem segurava a URL velha era o cache de
 * consulta, um degrau acima.
 *
 * O prazo é o MESMO do índice de nomes: um número só para dizer quanto tempo o
 * léxico pode estar desatualizado na tela, em vez de um por consumidor.
 *
 * ## E ele não vai para o disco
 *
 * `meta: { persist: false }`, pela razão que o `shouldPersist` do `Providers`
 * explica: guardar um cartão no IndexedDB não economiza espera nenhuma (ele só
 * é buscado no toque, e é pequeno), e faria uma imagem trocada ontem sobreviver
 * ao fechar e abrir o aplicativo.
 */
export function useLexiconCard(slug: string) {
  return useQuery({
    queryKey: ["lexicon-card", slug] as const,
    queryFn: () => requestLexiconCard(slug),
    staleTime: LEXICON_INDEX_STALE_MS,
    meta: { persist: false },
  });
}
