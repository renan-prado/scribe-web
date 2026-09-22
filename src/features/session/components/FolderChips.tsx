"use client";

import { MoreHorizontal, Plus } from "lucide-react";
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
import { isSessionDrag, readSessionDragId } from "@/features/session/lib/folder-dnd";
import { useLibraryWriter } from "@/features/session/query";
import type { Folder, FolderColor } from "@/lib/domain/folder";
import type { SessionListItem } from "@/lib/domain/session";
import { cn } from "@/lib/utils";

/**
 * A fileira de pastas da Biblioteca: cada uma é um par de botões IRMÃOS (o
 * nome, que navega, e o "⋯", que abre editar/excluir), nunca um botão dentro
 * de outro. É a mesma restrição que tirou o menu de três pontinhos dos
 * cartões (ver o cabeçalho de `PostItNote`) — ali o motivo era HTML inválido
 * (botão dentro de `<a>`); aqui não há link nenhum por baixo, mas a régua
 * continua valendo: dois controles precisam ser dois alvos de foco, não um
 * dentro do outro.
 *
 * ## Mover por ARRASTAR
 *
 * Cada chip é alvo de drop (`onDragOver`/`onDrop`, ver `folder-dnd.ts`): soltar
 * um cartão da Biblioteca aqui move a sessão para aquela pasta, com escrita
 * OTIMISTA nas duas pontas (a lista de sessões e, se a pasta em questão
 * estiver aberta, a contagem que `LibraryBrowser` já recalcula sozinho a
 * partir do `folderId` de cada sessão).
 *
 * A via de TECLADO é outra: dentro de uma sessão aberta, "Mover para pasta"
 * no menu (`MoveToFolderDialog`). Arrastar é conveniência de mouse, não a
 * única porta.
 */
type Props = {
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  /** O acervo INTEIRO (sem filtro de pasta), só para contar quantas sessões
   *  cada pasta tem — a conta que o diálogo de exclusão mostra. */
  sessions: SessionListItem[];
};

export function FolderChips({ selectedFolderId, onSelect, sessions }: Props) {
  const { data: folders } = useFolders();
  const folderWriter = useFolderWriter();
  const library = useLibraryWriter();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function handleCreate(name: string, color: FolderColor) {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const body = (await res.json().catch(() => ({}))) as { folder?: Folder; error?: string };
    if (!res.ok || !body.folder) {
      if (body.error === "name_taken") toast.error("Já existe uma pasta com esse nome.");
      throw new Error(body.error ?? "create_failed");
    }
    folderWriter.add(body.folder);
  }

  async function handleEdit(name: string, color: FolderColor) {
    if (!editing) return;
    const undo = folderWriter.patch(editing.id, { name, color });
    const res = await fetch(`/api/folders/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      undo();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "name_taken") toast.error("Já existe uma pasta com esse nome.");
      throw new Error("update_failed");
    }
  }

  async function handleDelete(deleteSessions: boolean) {
    if (!deleting) return;
    const wasSelected = selectedFolderId === deleting.id;
    const undoFolder = folderWriter.remove(deleting.id);
    const undoSessions = deleteSessions
      ? library.removeByFolder(deleting.id)
      : library.clearFolder(deleting.id);
    try {
      const res = await fetch(`/api/folders/${deleting.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteSessions }),
      });
      if (!res.ok) throw new Error("delete_failed");
      if (wasSelected) onSelect(null);
    } catch {
      undoFolder();
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

  const list = folders ?? [];

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {list.map((folder) => {
        const count = sessions.filter((s) => s.folderId === folder.id).length;
        const active = selectedFolderId === folder.id;
        const dragOver = dragOverId === folder.id;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: alvo de arrastar-e-soltar (onDragOver/onDrop), não de clique/teclado — o clique mora no <button> irmão de dentro.
          <div
            key={folder.id}
            onDragOver={(e) => {
              if (!isSessionDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverId !== folder.id) setDragOverId(folder.id);
            }}
            onDragLeave={() => setDragOverId((cur) => (cur === folder.id ? null : cur))}
            onDrop={(e) => {
              const sessionId = readSessionDragId(e);
              setDragOverId(null);
              if (!sessionId) return;
              e.preventDefault();
              void moveSession(sessionId, folder.id);
            }}
            className={cn(
              "flex shrink-0 items-center rounded-full transition-colors",
              active ? "bg-v2-card-hover" : "bg-v2-card hover:bg-v2-card-hover",
              dragOver && "ring-2 ring-scriba-blue/60"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(active ? null : folder.id)}
              className={cn(
                "flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2 text-[13px] font-medium outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                active ? "text-v2-ink" : "text-v2-ink-soft"
              )}
            >
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", SWATCH[folder.color ?? "mist"])}
              />
              <span className="max-w-[140px] truncate">{folder.name}</span>
              {count > 0 ? (
                <span className="text-[11px] font-light text-v2-ink-mute">{count}</span>
              ) : null}
            </button>
            <FolderChipMenu
              onEdit={() => setEditing(folder)}
              onDelete={() => setDeleting(folder)}
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-v2-card-hover px-3 py-1.5 text-[13px] font-medium text-v2-ink-soft outline-none transition-colors",
          "hover:bg-v2-card hover:text-v2-ink focus-visible:ring-2 focus-visible:ring-ring/50"
        )}
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
        Nova pasta
      </button>

      <FolderDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
      <FolderDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initialName={editing?.name}
        initialColor={editing?.color}
        onSave={handleEdit}
      />
      <DeleteFolderDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        folderName={deleting?.name ?? ""}
        sessionCount={deleting ? sessions.filter((s) => s.folderId === deleting.id).length : 0}
        onConfirm={handleDelete}
      />
    </div>
  );
}

const SWATCH: Record<string, string> = {
  mist: "bg-v2-note-mist",
  sage: "bg-v2-note-sage",
  slate: "bg-v2-note-slate",
  lemon: "bg-v2-note-lemon",
};

/**
 * O "⋯" de cada pasta: editar (nome + cor) ou excluir. É a única "ação
 * rápida" que sobrou no acervo, e ela mora na PASTA, não no cartão — o
 * cabeçalho deste arquivo explica por quê. O `DropdownMenu` é o MESMO
 * primitivo do `SessionMenu`, então o teclado (setas, Esc, Tab) se comporta
 * igual nos dois lugares.
 */
function FolderChipMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Opções da pasta"
        className="flex size-6 items-center justify-center rounded-full text-v2-ink-mute outline-none transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MoreHorizontal aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit}>Editar pasta</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Excluir pasta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
