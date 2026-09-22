"use client";

import { Folder as FolderIcon, FolderPlus, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteFolderDialog } from "@/features/session/components/DeleteFolderDialog";
import { FolderDialog } from "@/features/session/components/FolderDialog";
import { useFolders, useFolderWriter } from "@/features/session/folders-query";
import {
  folderDragProps,
  isFolderDrag,
  isSessionDrag,
  readFolderDragId,
  readSessionDragId,
} from "@/features/session/lib/folder-dnd";
import { useLibraryWriter } from "@/features/session/query";
import {
  FOLDER_ICON_INK,
  type Folder,
  folderChildren,
  folderCountLabel,
  folderDepth,
  folderSubtreeIds,
  MAX_FOLDER_DEPTH,
} from "@/lib/domain/folder";
import type { SessionListItem } from "@/lib/domain/session";
import { cn } from "@/lib/utils";

/**
 * As pastas de um nível da Biblioteca, desenhadas como CARTÕES numa grade —
 * a mesma gramática da vista `card` do acervo (ver `LibraryCard`), sob um
 * cabeçalho "Pastas" que é o mesmo `<h2>` de "Este mês".
 *
 * ## Elas eram uma fileira de pastilhas, e o problema era de PERTENCIMENTO
 *
 * A primeira versão (`FolderChips`, apagada) era uma fileira de chips
 * arredondados acima dos meses: um objeto de uma gramática que não existe em
 * mais nenhum lugar daquela tela, flutuando sem rótulo entre a barra do topo e
 * o primeiro cartão. Ela não estava feia, estava SOLTA — a Biblioteca é uma
 * sequência de seções com título e cartões embaixo, e a fileira era a única
 * coisa ali que não era nem título nem cartão.
 *
 * Com cartão e cabeçalho, pastas passam a ser a PRIMEIRA seção da lista, e não
 * uma barra de ferramentas antes dela. O ganho não é só estético: o cartão tem
 * onde dizer quantos resumos e quantas subpastas há dentro, o que a pastilha
 * só conseguia com um número solto ao lado do nome.
 *
 * **O ÍCONE de pasta faz o trabalho que o pontinho de cor não fazia.** Um
 * disco colorido ao lado de um nome não diz "isto é uma pasta", diz "isto tem
 * uma cor"; o glifo diz, e é o mesmo glifo do `MoveToFolderDialog`. A cor da
 * pasta passou a ser a TINTA dele (`FOLDER_ICON_INK`), e não um segundo objeto
 * na linha.
 *
 * ## Três níveis
 *
 * O cartão navega para dentro (`?pasta=<id>`), e é lá que as filhas dele
 * aparecem — não há árvore recolhível em lugar nenhum: o caminho inteiro cabe
 * na migalha de pão de `LibraryBrowser`, e uma árvore expansível num mural de
 * cartões seria uma segunda maneira de navegar a mesma coisa. O teto é do
 * BANCO (gatilho `folders_tree`, migração 0069); `MAX_FOLDER_DEPTH` aqui só
 * esconde "Nova pasta" no terceiro nível, para o gesto não existir antes de
 * falhar.
 *
 * ## Mover por ARRASTAR
 *
 * Cada cartão é alvo de drop e é ele mesmo arrastável (ver `folder-dnd.ts`):
 * soltar um cartão da Biblioteca aqui move a SESSÃO, soltar outro cartão de
 * pasta move a PASTA para dentro desta. As duas escritas são OTIMISTAS, e as
 * recusas da árvore (profundidade, ciclo) voltam do servidor como frase na
 * tela — o cliente não reimplementa a regra, ele a traduz.
 *
 * A via de TECLADO é outra, em dois lugares: "Mover para pasta" no menu de uma
 * sessão aberta (`MoveToFolderDialog`), e "Mover para a raiz" no "⋯" de uma
 * subpasta. Arrastar é conveniência de mouse, nunca a única porta.
 */
type Props = {
  /** O nível desenhado: `null` é a raiz. */
  parentId: string | null;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  /** O acervo INTEIRO (sem filtro de pasta), para contar o que há em cada
   *  pasta — a mesma conta que o diálogo de exclusão mostra. */
  sessions: SessionListItem[];
};

export function FolderGrid({ parentId, selectedFolderId, onSelect, sessions }: Props) {
  const { data: folders } = useFolders();
  const folderWriter = useFolderWriter();
  const library = useLibraryWriter();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const all = folders ?? [];
  const level = folderChildren(all, parentId);
  // Quantos degraus abaixo da raiz estamos: 0 na raiz, 1 dentro de uma pasta
  // de raiz. Uma pasta criada aqui nasce um degrau mais fundo que isso.
  const depth = folderDepth(all, parentId);
  const canCreate = depth < MAX_FOLDER_DEPTH;

  /** As sessões da subárvore de uma pasta — é o alcance de "excluir também as
   *  sessões" (ver `deleteFolder`), e por isso é esta a conta que o diálogo de
   *  exclusão recebe. */
  function subtreeSessionCount(folder: Folder): number {
    const ids = new Set(folderSubtreeIds(all, folder.id));
    return sessions.filter((s) => s.folderId && ids.has(s.folderId)).length;
  }

  async function handleCreate(name: string) {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    const body = (await res.json().catch(() => ({}))) as { folder?: Folder; error?: string };
    if (!res.ok || !body.folder) {
      toast.error(createMessage(body.error));
      throw new Error(body.error ?? "create_failed");
    }
    folderWriter.add(body.folder);
  }

  async function handleEdit(name: string) {
    if (!editing) return;
    const undo = folderWriter.patch(editing.id, { name });
    const res = await fetch(`/api/folders/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      undo();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(createMessage(body.error));
      throw new Error("update_failed");
    }
  }

  async function handleDelete(deleteSessions: boolean) {
    if (!deleting) return;
    const subtree = folderSubtreeIds(all, deleting.id);
    const wasInside = selectedFolderId !== null && subtree.includes(selectedFolderId);
    // A cascata do banco (0069) leva as subpastas junto, então o cache local
    // precisa perder a subárvore inteira, não só a linha clicada.
    const undoFolders = folderWriter.removeMany(subtree);
    const undoSessions = deleteSessions
      ? library.removeByFolders(subtree)
      : library.clearFolders(subtree);
    try {
      const res = await fetch(`/api/folders/${deleting.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteSessions }),
      });
      if (!res.ok) throw new Error("delete_failed");
      if (wasInside) onSelect(deleting.parentId);
    } catch {
      undoFolders();
      undoSessions();
      toast.error("Não foi possível excluir a pasta.");
      throw new Error("delete_failed");
    }
  }

  async function moveSession(sessionId: string, folderId: string) {
    const undo = library.patch(sessionId, { folderId });
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    }).catch(() => null);
    if (!res?.ok) {
      undo();
      toast.error("Não foi possível mover a sessão.");
    }
  }

  async function moveFolder(folderId: string, nextParentId: string | null) {
    if (folderId === nextParentId) return;
    const undo = folderWriter.patch(folderId, { parentId: nextParentId });
    const res = await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: nextParentId }),
    }).catch(() => null);
    if (!res?.ok) {
      undo();
      const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      toast.error(createMessage(body?.error));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Sem pasta nenhuma neste nível, o cabeçalho seria o rótulo de um botão
          só. O convite fica, sozinho e quieto; o título aparece quando há de
          fato uma lista para ele anunciar. */}
      {level.length > 0 ? (
        <h2 className="px-1 text-[15px] font-medium text-v2-ink-soft">Pastas</h2>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {level.map((folder) => {
          const direct = sessions.filter((s) => s.folderId === folder.id).length;
          const subfolders = folderChildren(all, folder.id).length;
          return (
            <li
              key={folder.id}
              {...folderDragProps(folder.id)}
              onDragOver={(e) => {
                if (!isSessionDrag(e) && !isFolderDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverId !== folder.id) setDragOverId(folder.id);
              }}
              onDragLeave={() => setDragOverId((cur) => (cur === folder.id ? null : cur))}
              onDrop={(e) => {
                setDragOverId(null);
                const sessionId = readSessionDragId(e);
                if (sessionId) {
                  e.preventDefault();
                  void moveSession(sessionId, folder.id);
                  return;
                }
                const dragged = readFolderDragId(e);
                if (dragged && dragged !== folder.id) {
                  e.preventDefault();
                  void moveFolder(dragged, folder.id);
                }
              }}
              className={cn(
                "relative rounded-2xl transition-shadow",
                dragOverId === folder.id && "ring-2 ring-scriba-blue/60"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(folder.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-2xl bg-v2-card p-4 pr-10 text-left outline-none transition-colors",
                  "hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute active:brightness-95"
                )}
              >
                <FolderIcon
                  aria-hidden
                  strokeWidth={1.75}
                  className={cn("mt-px size-5 shrink-0", FOLDER_ICON_INK[folder.color ?? "mist"])}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-normal leading-snug text-v2-ink">
                    {folder.name}
                  </span>
                  <span className="mt-1 block truncate text-[11px] font-light text-v2-ink-mute">
                    {folderCountLabel(subfolders, direct)}
                  </span>
                </span>
              </button>
              <FolderCardMenu
                nested={folder.parentId !== null}
                onEdit={() => setEditing(folder)}
                onMoveToRoot={() => void moveFolder(folder.id, null)}
                onDelete={() => setDeleting(folder)}
              />
            </li>
          );
        })}

        {/* No terceiro nível não há onde criar, e o botão sai em vez de ficar
            apagado: um controle desabilitado promete que existe um jeito de
            habilitá-lo, e aqui não existe. */}
        {canCreate ? (
          <li>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={cn(
                "flex h-full w-full items-center gap-2 rounded-2xl border border-dashed border-v2-card-hover p-4 text-left text-[13px] font-medium text-v2-ink-soft outline-none transition-colors",
                "hover:bg-v2-card hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
              )}
            >
              <FolderPlus aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
              Nova pasta
            </button>
          </li>
        ) : null}
      </ul>

      <FolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        parentName={all.find((f) => f.id === parentId)?.name ?? null}
        onSave={handleCreate}
      />
      <FolderDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initialName={editing?.name}
        onSave={handleEdit}
      />
      <DeleteFolderDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        folderName={deleting?.name ?? ""}
        sessionCount={deleting ? subtreeSessionCount(deleting) : 0}
        subfolderCount={deleting ? folderSubtreeIds(all, deleting.id).length - 1 : 0}
        onConfirm={handleDelete}
      />
    </section>
  );
}

/** As frases das recusas. `too_deep` e `cycle` vêm do gatilho do banco, e são
 *  as duas coisas que a tela não tenta prever: ela esconde o "Nova pasta" no
 *  último nível, mas arrastar uma subárvore alta para dentro de outra pasta é
 *  uma conta que só o banco tem como fazer. */
function createMessage(error: string | undefined): string {
  switch (error) {
    case "name_taken":
      return "Já existe uma pasta com esse nome aqui.";
    case "too_deep":
      return `Pastas vão até ${MAX_FOLDER_DEPTH} níveis.`;
    case "cycle":
      return "Uma pasta não pode entrar dentro de si mesma.";
    case "parent_not_found":
      return "A pasta de destino não existe mais.";
    default:
      return "Não foi possível salvar a pasta.";
  }
}

/**
 * O "⋯" de cada pasta: editar (nome e cor), mover para a raiz quando ela é
 * uma subpasta, e excluir. Ele é um botão IRMÃO do que navega, posicionado por
 * cima do canto do cartão — nunca um botão dentro de outro. É a mesma régua
 * que tirou o menu de três pontinhos dos cartões de sessão (ver o cabeçalho de
 * `PostItNote`): lá o impedimento era HTML inválido (botão dentro de `<a>`),
 * aqui não há link por baixo, mas dois controles continuam precisando ser dois
 * alvos de foco.
 *
 * O `DropdownMenu` é o MESMO primitivo do `SessionMenu`, então o teclado
 * (setas, Esc, Tab) se comporta igual nos dois lugares.
 */
function FolderCardMenu({
  nested,
  onEdit,
  onMoveToRoot,
  onDelete,
}: {
  nested: boolean;
  onEdit: () => void;
  onMoveToRoot: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Opções da pasta"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-v2-ink-mute outline-none transition-colors hover:bg-black/20 hover:text-v2-ink focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>Editar pasta</DropdownMenuItem>
        {nested ? (
          <DropdownMenuItem onClick={onMoveToRoot}>Mover para a raiz</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Excluir pasta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
