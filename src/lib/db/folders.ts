import "server-only";
import { type Folder, parseFolderColor } from "@/lib/domain/folder";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * Persistência das pastas (migração 0068). RLS escopa toda leitura e escrita
 * ao dono (`user_id`), então nenhuma função aqui filtra por conta na mão.
 */

type DbRow = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

function rowToFolder(row: DbRow): Folder {
  return {
    id: row.id,
    name: row.name,
    color: row.color ? parseFolderColor(row.color) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = "id, name, color, created_at, updated_at";

/** Todas as pastas do usuário, por nome — é a ordem em que a fileira de chips
 *  as mostra, e o acervo raramente passa de uma dúzia delas. */
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
};

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) throw new Error("createFolder: not authenticated");

  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: user.id, name: input.name.trim(), color: input.color })
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
};

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("folders").update(patch).eq("id", id);
  if (error) throw new Error(`updateFolder failed: ${error.message}`);
}

/**
 * Apaga a pasta. `deleteSessions` decide o destino do que estava dentro:
 *
 * - `false` (padrão): as sessões ficam, só perdem o vínculo. Não precisa de
 *   UPDATE nenhum aqui — o `on delete set null` de `sessions.folder_id`
 *   (migração 0068) já faz isso no banco quando a linha da pasta some.
 * - `true`: apaga também as sessões que estavam dentro dela, ANTES de apagar
 *   a pasta (a ordem importa por clareza, não por integridade: com `set
 *   null` a ordem inversa também funcionaria, mas apagar a pasta primeiro e
 *   as sessões depois leria como dois passos que não se explicam).
 */
export async function deleteFolder(id: string, deleteSessions: boolean): Promise<void> {
  const supabase = await createClient();
  if (deleteSessions) {
    const { error: sessionsError } = await supabase.from("sessions").delete().eq("folder_id", id);
    if (sessionsError) {
      throw new Error(`deleteFolder (sessions) failed: ${sessionsError.message}`);
    }
  }
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw new Error(`deleteFolder failed: ${error.message}`);
}
