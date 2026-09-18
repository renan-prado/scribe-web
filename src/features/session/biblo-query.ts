"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSessionOwner } from "@/features/session/query";
import type { BibloAllowance, BibloConversation, BibloMessage } from "@/lib/domain/biblo";

/**
 * A conversa com o Biblo do lado do CLIENTE, guardada no aparelho.
 *
 * ## O problema
 *
 * A gaveta nascia do zero a cada abertura. O `BibloDock` desmonta o
 * `BibloDrawer` inteiro quando ela fecha (é o que faz o botão VIRAR a gaveta),
 * então o estado da conversa morria junto e o `GET /api/biblo` recomeçava do
 * nada na abertura seguinte. Quem fechava para conferir um versículo no resumo
 * e voltava esperava a conversa carregar de novo, com os três pontos no meio da
 * gaveta, para reler o que já tinha lido.
 *
 * Aqui ela é lida do disco (IndexedDB, ver `lib/idb-storage.ts` e o
 * `PersistQueryClientProvider` de `shared/components/Providers.tsx`) e desenhada
 * no primeiro quadro, enquanto a rede confere atrás. É o mesmo stale-while-
 * revalidate da Biblioteca (`features/session/query.ts`), pela mesma razão e com
 * o mesmo escopo de chave.
 *
 * ## Por que dá para guardar, e por que dá para PRÉ-BUSCAR
 *
 * Porque o `GET` não cobra, não chama modelo e não grava nada, e porque a
 * conversa só muda quando é a própria pessoa que manda uma mensagem — e esse
 * caminho escreve no cache aqui mesmo (`useBibloWriter`). Não existe a conversa
 * que andou sozinha no servidor enquanto a gaveta estava fechada.
 *
 * O que sobra de verdadeiramente volátil é o `allowance`: o presente pode ter
 * acabado numa conversa de OUTRA sessão, o saldo pode ter mudado numa compra,
 * o kill switch pode ter sido puxado. É por isso que o `staleTime` é curto e a
 * revalidação acontece toda vez — o que o cache remove é a ESPERA, nunca a
 * conferência. E o servidor continua sendo o dono da decisão: a gaveta pode
 * abrir otimista com o rodapé de ontem, mas quem cobra é o `POST`, que
 * reconfere antes de debitar.
 *
 * ## A chave carrega o dono, como a da Biblioteca
 *
 * O cache é do APARELHO, e um aparelho pode receber duas contas. Uma conversa
 * é mais íntima que uma lista de sermões, então o argumento vale ainda mais
 * aqui: com a chave escopada, quem entra depois simplesmente não tem entrada
 * nenhuma. A limpeza do disco de quem saiu é do `CacheOwnerGuard`.
 */

/**
 * Quanto tempo a conversa guardada vale sem conferir.
 *
 * Trinta segundos é o bastante para o ciclo que motivou tudo isto (fechar,
 * olhar o resumo, reabrir) não tocar a rede, e curto o bastante para o rodapé
 * não ficar prometendo um presente que acabou noutra aba. Passado ele, a gaveta
 * ainda abre instantânea com o que está no disco: a revalidação corre atrás.
 */
const BIBLO_STALE_MS = 30_000;

export function bibloKey(userId: string | null, sessionId: string): readonly unknown[] {
  return ["biblo", "conversation", userId, sessionId] as const;
}

async function fetchConversation(sessionId: string): Promise<BibloConversation> {
  const response = await fetch(`/api/biblo?sessionId=${sessionId}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET /api/biblo: ${response.status}`);
  return (await response.json()) as BibloConversation;
}

/**
 * A conversa. `data` vem do disco no primeiro quadro quando a gaveta já foi
 * aberta alguma vez neste aparelho; `undefined` só na primeira de todas, e é aí
 * que a gaveta mostra os três pontos.
 *
 * `enabled` espera o dono pela mesma razão da Biblioteca: sem id, a chave
 * apontaria para um balde comum a todas as contas.
 */
export function useBibloConversation(sessionId: string) {
  const userId = useSessionOwner();
  return useQuery({
    queryKey: bibloKey(userId, sessionId),
    queryFn: () => fetchConversation(sessionId),
    enabled: userId !== null,
    staleTime: BIBLO_STALE_MS,
  });
}

/**
 * As escritas da conversa: a pergunta e a resposta que acabaram de chegar.
 *
 * Elas iam para um `useState` dentro da gaveta, e era isso que fazia o
 * fechar-e-abrir perder a última rodada mesmo com a conversa em cache: o
 * servidor tinha as duas linhas, o cache não. Escrever aqui é o que mantém as
 * duas versões da mesma conversa concordando sem uma segunda ida à rede.
 *
 * ## A pré-busca
 *
 * `prefetch` é chamado pelo `BibloDock` quando a tela monta, e é o que faz a
 * PRIMEIRA abertura ser instantânea também. Ela não custa nada a ninguém: o
 * `GET` não cobra, não chama modelo e não grava (ver o cabeçalho da rota). E
 * ela é `prefetchQuery`, não `fetchQuery` — com algo fresco no cache, ela não
 * faz nada, então uma tela que monta duas vezes não vira duas consultas.
 *
 * O `useMemo` não é otimização: o `send` da gaveta tem estas funções na lista
 * de dependências, e um objeto novo a cada render faria o `useCallback` de lá
 * ser recriado a cada tecla digitada.
 */
export function useBibloWriter(sessionId: string) {
  const client = useQueryClient();
  const userId = useSessionOwner();

  return useMemo(() => {
    const key = bibloKey(userId, sessionId);
    return {
      prefetch: () => {
        if (userId === null) return;
        void client.prefetchQuery({
          queryKey: key,
          queryFn: () => fetchConversation(sessionId),
          staleTime: BIBLO_STALE_MS,
        });
      },
      /** A rodada que voltou do `POST`: as duas linhas e o novo `allowance`. */
      appendTurn: (messages: BibloMessage[], allowance: BibloAllowance) =>
        client.setQueryData<BibloConversation>(key, (prev) =>
          prev ? { ...prev, messages: [...prev.messages, ...messages], allowance } : prev
        ),
      /**
       * Só o `allowance`, quando o servidor recusou. É o 402/403 dizendo que o
       * presente acabou ou que o saldo zerou, e o rodapé precisa saber disso
       * mesmo sem mensagem nova para mostrar.
       */
      setAllowance: (allowance: BibloAllowance) =>
        client.setQueryData<BibloConversation>(key, (prev) =>
          prev ? { ...prev, allowance } : prev
        ),
    };
  }, [client, userId, sessionId]);
}
