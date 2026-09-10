"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type ContentSearchResult, requestContentSearch } from "@/features/session/lib/api";

/**
 * A metade SERVIDOR da busca das listas: o que a sessão DISSE (transcrição) e o
 * que ela CITOU (versículos).
 *
 * A outra metade (título, resumo curto, autor, local, data) é síncrona e roda
 * sobre o que a página já tem, ver `src/features/session/lib/search.ts`. Este
 * hook existe porque nem a transcrição nem os cards vão para a lista.
 *
 * ## O que ele devolve, e por que `ids` é um `Set | null`
 *
 * `null` significa "não há resposta de conteúdo para esta consulta", termo
 * curto demais, requisição em voo, ou falha. Nesse estado a lista mostra
 * APENAS o que casou localmente, que é o comportamento correto: a busca já
 * responde na primeira tecla e os cartões do servidor entram depois, somando.
 * Se `null` significasse "conjunto vazio", cada tecla apagaria os resultados
 * por um instante, o pisca-pisca que faz uma busca parecer quebrada.
 *
 * `verses` diz QUAL referência casou em cada sessão, e não só que casou: é o
 * texto da pastilha do cartão. Um cartão que aparece por um versículo que não
 * está escrito em lugar nenhum dele parece defeito da busca.
 *
 * ## Por que `pending` existe
 *
 * `ids === null` sozinho não distingue "ainda estou procurando" de "procurei e
 * não achei", e a lista precisa das duas: sem essa distinção ela desenha
 * "Nenhuma gravação com esse recorte" no intervalo entre a tecla e a resposta,
 * e o cartão que só casa no servidor aparece DEPOIS, a tela afirma que não há
 * nada e se desmente meio segundo mais tarde. Foi exatamente o que aconteceu
 * com um trecho que só existia dentro do sermão.
 *
 * `pending` é derivado no render, não guardado num `useState` ligado no efeito:
 * o estado carrega o termo que ele responde, então ele já nasce verdadeiro no
 * mesmo render em que a tecla chega. Um `setPending(true)` dentro do efeito
 * deixaria passar um quadro com a consulta nova e `pending` falso, o mesmo
 * "nada encontrado" piscando, só que mais difícil de reproduzir.
 *
 * Ele cobre o DEBOUNCE também, e não só a requisição: os 260ms de espera são
 * parte do tempo em que a resposta não chegou.
 *
 * ## Ordem de chegada
 *
 * `seq` descarta resposta de consulta velha. Sem ele, uma requisição lenta de
 * "gra" chegando depois da de "graça" repintaria a lista com os resultados do
 * termo anterior, e o usuário não tem como saber que o que está vendo não é o
 * que digitou.
 */

/** O mesmo piso de `/api/sessions/search`: abaixo disto ninguém procura. */
const MIN_TERM_LENGTH = 3;

const NO_VERSES: ReadonlyMap<string, string> = new Map();

export type ContentSearch = {
  /** Ids que casaram no servidor, ou `null` quando não há resposta. */
  ids: Set<string> | null;
  /** sessionId → referência citada que casou com a busca. */
  verses: ReadonlyMap<string, string>;
  /** Há uma resposta a caminho para o termo atual (debounce incluído). */
  pending: boolean;
};

/** O termo que a resposta responde. Guardados JUNTOS de propósito, separados,
 *  um render pegaria os ids de um termo com o rótulo de outro. */
type Answer = { term: string; result: ContentSearchResult | null };

export function useContentSearch(query: string, debounceMs = 260): ContentSearch {
  const [answer, setAnswer] = useState<Answer>({ term: "", result: null });
  const seqRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const seq = ++seqRef.current;
    if (term.length < MIN_TERM_LENGTH) {
      setAnswer({ term, result: null });
      return;
    }
    const t = setTimeout(() => {
      void requestContentSearch(term).then((found) => {
        if (seqRef.current !== seq) return;
        // Falha e "não achei nada" chegam as duas aqui, e as duas encerram a
        // espera: o resultado volta a null (a lista fica com o que casou
        // localmente) mas `pending` cai, senão o loading giraria para sempre.
        setAnswer({ term, result: found });
      });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const term = query.trim();
  // A resposta do termo ANTERIOR continua na tela enquanto a nova não chega. É
  // a mesma escolha do `null`: apagá-la a cada tecla pisca a lista inteira.
  // Quem lê `pending` sabe que aquilo ainda não é a resposta final.
  return useMemo(
    () => ({
      ids: answer.result ? new Set(answer.result.ids) : null,
      verses: answer.result?.verses ?? NO_VERSES,
      pending: term.length >= MIN_TERM_LENGTH && answer.term !== term,
    }),
    [answer, term]
  );
}
