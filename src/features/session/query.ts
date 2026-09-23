"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect } from "react";
import type { SessionListItem } from "@/lib/domain/session";

/**
 * O acervo do lado do CLIENTE: a Biblioteca guardada no aparelho.
 *
 * ## O problema
 *
 * A lista vinha do render do servidor de `/home`. Toda abertura do app e toda
 * volta para a Biblioteca refaziam a consulta do zero, com a tela em esqueleto
 * até a resposta chegar. Num WebView que o Android mata a cada troca de app,
 * "toda abertura" é o tempo todo — e é exatamente a tela em que se cai.
 *
 * Aqui a lista é lida do disco (IndexedDB, ver `lib/idb-storage.ts`) e
 * desenhada na hora, enquanto `GET /api/sessions` confere atrás o que mudou.
 * É o stale-while-revalidate de sempre, com a diferença que importa: o "stale"
 * sobrevive ao fechamento do app.
 *
 * ## Por que a chave carrega o id do usuário
 *
 * O cache é do APARELHO, e um aparelho pode receber duas contas. Com a chave
 * escopada, quem entra depois simplesmente não tem entrada nenhuma no cache e
 * busca do servidor — não existe o instante em que a Biblioteca de outra pessoa
 * aparece na tela. É correção, não higiene: um `useEffect` que limpasse o cache
 * rodaria DEPOIS do primeiro desenho.
 *
 * A higiene vem junto, no `CacheOwnerGuard`: o cache do dono anterior é apagado
 * do disco quando outro entra.
 *
 * ## De onde vem o id
 *
 * Do layout de `(shell)`, que já leu a conta para desenhar o avatar (ver
 * `SessionOwnerProvider`). Não custa consulta nenhuma, e é o mesmo id que a RLS
 * usa do outro lado.
 */

const SessionOwnerContext = createContext<string | null>(null);

/**
 * Quem é o dono do cache nesta árvore. É um provider, e não um módulo global,
 * porque estado de sessão num singleton sobrevive a coisas que não deveria —
 * um teste, um hot reload, uma segunda montagem.
 */
export const SessionOwnerProvider = SessionOwnerContext.Provider;

export function useSessionOwner(): string | null {
  return useContext(SessionOwnerContext);
}

export function libraryKey(userId: string | null): readonly unknown[] {
  return ["sessions", "list", userId] as const;
}

async function fetchLibrary(): Promise<SessionListItem[]> {
  const response = await fetch("/api/sessions", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`GET /api/sessions: ${response.status}`);
  const body = (await response.json()) as { sessions: SessionListItem[] };
  return body.sessions;
}

/**
 * A Biblioteca. `data` vem do disco no primeiro quadro quando já houve uma
 * visita; `undefined` só na primeira vez de todas, e é aí que a tela mostra
 * esqueleto.
 *
 * `enabled` espera o dono: sem id, a chave apontaria para um balde comum a
 * todas as contas, que é justamente o que o escopo existe para impedir.
 */
export function useLibrary(initial?: SessionListItem[]) {
  const userId = useSessionOwner();
  return useQuery({
    queryKey: libraryKey(userId),
    queryFn: fetchLibrary,
    enabled: userId !== null,
    initialData: initial,
    // A lista muda quando a própria pessoa cria, renomeia ou apaga algo — e
    // esses caminhos já escrevem no cache (ver `useLibraryWriter`). O que sobra
    // é a sessão criada em OUTRO aparelho, e meio minuto de atraso nela não é
    // nada perto de uma revalidação a cada montagem.
    staleTime: 30_000,
    // O contrário do padrão deste QueryClient, e de propósito: voltar ao app é
    // o momento em que a lista mais provavelmente mudou (a gravação acabou de
    // terminar noutra aba, o pagamento entrou). É uma consulta barata.
    refetchOnWindowFocus: true,
  });
}

/**
 * As escritas OTIMISTAS da Biblioteca: mexer na lista antes de o servidor
 * responder.
 *
 * Não há mutação aqui, só o acesso ao cache. Quem chama já tem o `fetch` que
 * precisa fazer — criar, renomear, apagar — e o que faltava era a lista da tela
 * concordar com aquilo IMEDIATAMENTE, em vez de esperar um recarregamento de
 * página para descobrir o que a própria pessoa acabou de fazer.
 *
 * `rollback` é o preço de ser otimista: se a chamada falhar, o que se desfez
 * volta. Quem chama guarda o retorno de `remove`/`patch` e o executa no catch.
 */
export function useLibraryWriter() {
  const client = useQueryClient();
  const userId = useSessionOwner();
  const key = libraryKey(userId);

  function write(update: (list: SessionListItem[]) => SessionListItem[]): () => void {
    const previous = client.getQueryData<SessionListItem[]>(key);
    if (!previous) return () => {};
    client.setQueryData<SessionListItem[]>(key, update(previous));
    return () => client.setQueryData<SessionListItem[]>(key, previous);
  }

  return {
    /** Tira a sessão da lista na hora. Devolve o desfazer. */
    remove: (id: string) => write((list) => list.filter((item) => item.id !== id)),
    /** Aplica uma mudança de campo (título, autor, local). Devolve o desfazer. */
    patch: (id: string, fields: Partial<SessionListItem>) =>
      write((list) => list.map((item) => (item.id === id ? { ...item, ...fields } : item))),
    /** Tira da lista TODA sessão de um conjunto de pastas — o lado "excluir
     *  também as sessões" de apagar uma pasta (ver `DeleteFolderDialog`).
     *  Recebe a SUBÁRVORE e não um id só, porque apagar uma pasta apaga as
     *  filhas por cascata (migração 0069) e o conteúdo delas vai no mesmo
     *  gesto. Devolve o desfazer. */
    removeByFolders: (folderIds: string[]) => {
      const ids = new Set(folderIds);
      return write((list) => list.filter((s) => !(s.folderId && ids.has(s.folderId))));
    },
    /** Tira o vínculo de pasta de toda sessão que estava na subárvore — o lado
     *  "mover para a raiz". O banco já faz isto sozinho (`on delete set null`
     *  em `sessions.folder_id`, migração 0068); aqui é só o cache do aparelho
     *  acompanhando. Devolve o desfazer. */
    clearFolders: (folderIds: string[]) => {
      const ids = new Set(folderIds);
      return write((list) =>
        list.map((s) => (s.folderId && ids.has(s.folderId) ? { ...s, folderId: null } : s))
      );
    },
    /** Marca a lista como velha para que a próxima montagem confira. */
    invalidate: () => client.invalidateQueries({ queryKey: key }),
  };
}

/**
 * O contrário do otimismo: descobrir que o cache está ATRASADO, e consertá-lo.
 *
 * Chamado pela tela do resumo com o id que ela está mostrando. Se a Biblioteca
 * guardada no aparelho não conhece essa sessão, ela é velha — e a tela do
 * resumo é justamente onde todo caminho de criação desemboca: terminar uma
 * gravação, importar um vídeo, escrever um resumo à mão. Um ponto só, e ele
 * pega os três sem que nenhum precise saber que existe um cache.
 *
 * A alternativa era um `invalidate` em cada um dos três, que é três lugares
 * para esquecer um — e o quarto caminho, quando existir, nasceria esquecido.
 *
 * Sem cache nenhum não há o que consertar: a próxima montagem da Biblioteca
 * busca tudo de qualquer jeito.
 */
export function useLibrarySync(sessionId: string) {
  const client = useQueryClient();
  const userId = useSessionOwner();

  useEffect(() => {
    if (userId === null) return;
    const key = libraryKey(userId);
    const list = client.getQueryData<SessionListItem[]>(key);
    if (!list || list.some((item) => item.id === sessionId)) return;
    void client.invalidateQueries({ queryKey: key });
  }, [client, userId, sessionId]);
}
