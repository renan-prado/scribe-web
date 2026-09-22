"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Folder } from "@/lib/domain/folder";
import { useSessionOwner } from "./query";

/**
 * As pastas do usuário no cache do cliente. Mesmo desenho de `query.ts`
 * (`useLibrary`/`useLibraryWriter`), num acervo bem menor: uma conta tem
 * dezenas de sessões e raramente mais que uma dúzia de pastas, então não há
 * IndexedDB dedicado aqui — o `PersistQueryClientProvider` já grava TODA
 * query bem-sucedida no disco (ver `src/shared/AGENTS.md`), o que esta lista
 * ganha de graça.
 *
 * A chave reaproveita `useSessionOwner()` de `query.ts`: é o MESMO id de
 * conta que escopa a Biblioteca, lido do mesmo provider — duas listas do
 * mesmo aparelho, dois nomes de chave, um dono.
 */

export function foldersKey(userId: string | null): readonly unknown[] {
  return ["folders", "list", userId] as const;
}

async function fetchFolders(): Promise<Folder[]> {
  const response = await fetch("/api/folders", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`GET /api/folders: ${response.status}`);
  const body = (await response.json()) as { folders: Folder[] };
  return body.folders;
}

/**
 * O PRIMEIRO render do cliente devolve `undefined`, mesmo com a lista já no
 * disco, e isso é correção de um defeito e não cautela.
 *
 * O HTML do servidor nunca tem pasta nenhuma — elas são do aparelho, e o
 * `PersistQueryClientProvider` as restaura do IndexedDB num efeito lá em cima.
 * Essa restauração pode terminar ANTES de esta árvore hidratar (o
 * `loading.tsx` da Biblioteca a põe dentro de um `<Suspense>`, e o React
 * hidrata boundary por boundary), e aí o primeiro render daqui já tem o
 * cabeçalho "Pastas" e os cartões onde o servidor tinha posto nada: mismatch
 * de hidratação, a árvore inteira descartada e refeita, com um erro
 * recuperável no console. Era exatamente o `<h2>Pastas</h2>` do `FolderGrid`
 * que o React apontava.
 *
 * O guard mora AQUI, e não em cada tela, porque são três consumidores
 * (`FolderGrid`, `LibraryBrowser`, `SavedSessionView`) e esquecer um é um
 * defeito que só aparece no console de quem já tem pastas guardadas. É o
 * mesmo raciocínio do `hydrated` de `LibraryBrowser`, um degrau mais fundo: lá
 * ele precisa ficar na tela porque a Biblioteca distingue "ainda não sei"
 * (esqueleto) de "está vazia" (o convite a gravar), e pasta não tem essa
 * diferença — sem saber, não se desenha pasta nenhuma.
 *
 * Custa UM QUADRO e nenhuma ida à rede.
 */
export function useFolders() {
  const userId = useSessionOwner();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { data, ...rest } = useQuery({
    queryKey: foldersKey(userId),
    queryFn: fetchFolders,
    enabled: userId !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return { ...rest, data: hydrated ? data : undefined };
}

/**
 * Escritas otimistas sobre a lista de pastas. Mesmo contrato de
 * `useLibraryWriter`: quem chama guarda o `rollback` devolvido e o executa se
 * a chamada de rede falhar.
 */
export function useFolderWriter() {
  const client = useQueryClient();
  const userId = useSessionOwner();
  const key = foldersKey(userId);

  function write(update: (list: Folder[]) => Folder[]): () => void {
    const previous = client.getQueryData<Folder[]>(key);
    if (!previous) return () => {};
    client.setQueryData<Folder[]>(key, update(previous));
    return () => client.setQueryData<Folder[]>(key, previous);
  }

  return {
    add: (folder: Folder) =>
      write((list) => [...list, folder].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))),
    /** Tira a pasta E a descendência dela: `folders.parent_id` é
     *  `on delete cascade` (migração 0069), então apagar uma linha apaga a
     *  subárvore no banco, e o cache tem de perder as mesmas linhas — senão a
     *  tela mostra subpastas de uma pasta que já não existe. */
    removeMany: (ids: string[]) => {
      const set = new Set(ids);
      return write((list) => list.filter((f) => !set.has(f.id)));
    },
    patch: (id: string, fields: Partial<Folder>) =>
      write((list) =>
        list
          .map((f) => (f.id === id ? { ...f, ...fields } : f))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      ),
    invalidate: () => client.invalidateQueries({ queryKey: key }),
  };
}
