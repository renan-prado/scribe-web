import "server-only";
import { type Folder, folderSubtreeIds, parseFolderColor } from "@/lib/domain/folder";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * Persistência das pastas (migrações 0068 e 0069). RLS escopa toda leitura e
 * escrita ao dono (`user_id`), então nenhuma função aqui filtra por conta na
 * mão.
 *
 * **A ÁRVORE é regra do banco, não daqui.** Profundidade máxima, ciclo e
 * "o pai é do mesmo dono" são o gatilho `folders_tree` da 0069: nada nestas
 * funções confere nível nenhum, e uma escrita inválida volta como erro do
 * Postgres para a rota traduzir (`folder_too_deep`, `folder_cycle`,
 * `parent_not_found`).
 */

type DbRow = {
  id: string;
  name: string;
  color: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToFolder(row: DbRow): Folder {
  return {
    id: row.id,
    name: row.name,
    color: row.color ? parseFolderColor(row.color) : null,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = "id, name, color, parent_id, created_at, updated_at";

/**
 * Traduz a recusa do gatilho `folders_tree` (migração 0069) para o código que
 * as duas rotas de pasta devolvem. Ele levanta a exceção com o nome do
 * problema na MENSAGEM, e não num `errcode` próprio, porque os códigos de
 * erro do Postgres não têm um slot para "regra desta aplicação" — o
 * `23514` que ele usa é `check_violation`, que é o que a regra é.
 *
 * Devolve `null` para qualquer outro erro, e é o `null` que mantém a
 * diferença entre "a pessoa pediu algo impossível" (409, com frase própria na
 * tela) e "algo quebrou aqui" (500, com linha no log).
 */
export function folderTreeError(message: string): "too_deep" | "cycle" | "parent_not_found" | null {
  if (/folder_too_deep/.test(message)) return "too_deep";
  if (/folder_cycle/.test(message)) return "cycle";
  if (/parent_not_found/.test(message)) return "parent_not_found";
  return null;
}

/** Todas as pastas do usuário, por nome — é a ordem em que cada nível da
 *  árvore aparece na tela, e o acervo raramente passa de uma dúzia delas.
 *  A lista vem PLANA de propósito; quem monta a árvore é o cliente, com os
 *  helpers de `domain/folder.ts`. */
export async function listFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw new Error(`listFolders failed: ${error.message}`);
  return (data ?? []).map((r) => rowToFolder(r as DbRow));
}

export async function getFolder(id: string): Promise<Folder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`getFolder failed: ${error.message}`);
  return data ? rowToFolder(data as DbRow) : null;
}

export type CreateFolderInput = {
  name: string;
  color: string | null;
  parentId?: string | null;
};

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) throw new Error("createFolder: not authenticated");

  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      color: input.color,
      parent_id: input.parentId ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    throw new Error(`createFolder failed: ${error?.message ?? "no row returned"}`);
  }
  return rowToFolder(data as DbRow);
}

export type UpdateFolderInput = {
  name?: string;
  color?: string | null;
  /** `null` move para a raiz; ausente não mexe no lugar dela. */
  parentId?: string | null;
};

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("folders").update(patch).eq("id", id);
  if (error) throw new Error(`updateFolder failed: ${error.message}`);
}

/**
 * Apaga a pasta E as subpastas dela — `folders.parent_id` é
 * `on delete cascade` (migração 0069), então a descendência inteira vai junto
 * sem um DELETE por nível aqui.
 *
 * `deleteSessions` decide o destino do CONTEÚDO:
 *
 * - `false` (padrão): as sessões ficam, só perdem o vínculo. Não precisa de
 *   UPDATE nenhum aqui — o `on delete set null` de `sessions.folder_id`
 *   (migração 0068) já faz isso no banco quando a linha da pasta some, e vale
 *   igual para as sessões que estavam nas subpastas.
 * - `true`: apaga também as sessões, ANTES de apagar a pasta (a ordem importa
 *   por clareza, não por integridade: com `set null` a ordem inversa também
 *   funcionaria, mas apagar a pasta primeiro e as sessões depois leria como
 *   dois passos que não se explicam).
 *
 * **O alcance é a SUBÁRVORE, não a pasta.** Com um nível só, "apagar também
 * as sessões" e "as sessões cujo `folder_id` é este" eram a mesma frase; com
 * três, um `.eq("folder_id", id)` deixaria intacto tudo que estava nas
 * subpastas, que é justamente o conteúdo que a pessoa acabou de mandar apagar.
 * A lista de ids sai da árvore lida aqui (`folderSubtreeIds`), porque são
 * poucas linhas e uma leitura a mais é mais barata que um CTE recursivo numa
 * RPC nova.
 */
export async function deleteFolder(id: string, deleteSessions: boolean): Promise<void> {
  const supabase = await createClient();
  if (deleteSessions) {
    const ids = folderSubtreeIds(await listFolders(), id);
    const { error: sessionsError } = await supabase.from("sessions").delete().in("folder_id", ids);
    if (sessionsError) {
      throw new Error(`deleteFolder (sessions) failed: ${sessionsError.message}`);
    }
  }
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw new Error(`deleteFolder failed: ${error.message}`);
}
