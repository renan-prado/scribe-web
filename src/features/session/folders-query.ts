"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useFolders() {
  const userId = useSessionOwner();
  return useQuery({
    queryKey: foldersKey(userId),
    queryFn: fetchFolders,
    enabled: userId !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
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
