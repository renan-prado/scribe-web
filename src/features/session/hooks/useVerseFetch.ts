"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useResolvedTranslation } from "@/features/session/components/TranslationScope";
import { requestPassage } from "@/features/session/lib/api";
import type { VerseFetchState } from "@/features/session/types";
import { DEFAULT_TRANSLATION, type TranslationId } from "@/lib/bibles/translations";
import type { PassagePayload } from "@/lib/domain/verse";

/**
 * Opções compartilhadas da busca de passagem. O hook e os prefetchers usam as
 * MESMAS, senão as entradas de cache não colidem e o prefetch não serve para
 * nada.
 *
 * A chave é a passagem inteira ("Isaías 1:11-17"), não o versículo. Antes era
 * uma entrada por versículo e uma requisição por entrada, sete chamadas para
 * essa referência, e um estudo com muitas passagens estourava o rate limit.
 */
export function passageQueryOptions(
  reference: string,
  translation: TranslationId = DEFAULT_TRANSLATION
) {
  return queryOptions<PassagePayload>({
    // A TRADUÇÃO entra na chave, e não é enfeite: sem ela o mesmo "João 3:16"
    // guardado numa tradução seria servido em todas as outras, e trocar a
    // tradução de um bloco devolveria o texto antigo de um cache com
    // `staleTime` infinito — o mesmo cache que o servidor semeia.
    queryKey: ["passage", translation, reference] as const,
    queryFn: async () => {
      const result = await requestPassage(reference, translation);
      if (!result.ok) throw new Error(result.message);
      return result.payload;
    },
    // O texto bíblico não muda. Sem isto, voltar para uma sessão refaz todas as
    // buscas por causa do `staleTime: 0` padrão do React Query.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Prefetcher estável para aquecer o cache, usado pelo pipeline ao vivo, para
 * que o texto já esteja em memória quando o card correspondente montar.
 */
export function useVersePrefetcher() {
  const queryClient = useQueryClient();
  const translation = useResolvedTranslation();
  return useCallback(
    (reference: string) => {
      void queryClient.prefetchQuery(passageQueryOptions(reference, translation));
    },
    [queryClient, translation]
  );
}

/**
 * O texto de uma passagem. Uma chamada por passagem, com todos os versículos
 * dela.
 *
 * Sem o segundo argumento, na tradução de quem está lendo (ver
 * `TranslationScope`); com ele, na tradução daquela citação. É por aqui que
 * "este versículo em Almeida, o resto como sempre" atravessa a árvore inteira.
 */
export function useVerseFetch(
  reference: string | null,
  translation?: TranslationId
): VerseFetchState {
  const resolved = useResolvedTranslation(translation);
  const query = useQuery({
    ...(reference !== null
      ? passageQueryOptions(reference, resolved)
      : { queryKey: ["passage", "__idle__"] as const, queryFn: async () => null as never }),
    enabled: reference !== null,
  });

  if (!reference) return { status: "idle" };

  const payload = query.data as PassagePayload | undefined;
  if (query.isError && !payload) {
    return { status: "error", message: (query.error as Error).message };
  }
  if (!payload) return { status: "loading" };
  return { status: "ok", reference: payload.reference, verses: payload.verses };
}
