import { FileText, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SessionMenuProps = {
  hasTranscript: boolean;
  hasLiveFeed: boolean;
  onOpenTranscript: () => void;
  onOpenLiveFeed: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function SessionMenu({
  hasTranscript,
  hasLiveFeed,
  onOpenTranscript,
  onOpenLiveFeed,
  onEdit,
  onDelete,
}: SessionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-scriba-ink-mute transition-colors outline-none",
          "hover:bg-scriba-blue-soft/60 hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        aria-label="Mais opções"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onEdit ? (
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={!hasLiveFeed} onClick={onOpenLiveFeed} className="gap-2">
          <Sparkles className="size-4" />
          Ver conteúdo do live
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasTranscript} onClick={onOpenTranscript} className="gap-2">
          <FileText className="size-4" />
          Ler transcrição
        </DropdownMenuItem>
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete} className="gap-2">
              <Trash2 className="size-4" />
              Excluir resumo
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
