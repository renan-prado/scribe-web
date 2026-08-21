import { FileText, MoreVertical, Pencil, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SessionMenu({
  hasTranscript,
  hasLiveFeed,
  onOpenTranscript,
  onOpenLiveFeed,
  onEdit,
}: {
  hasTranscript: boolean;
  hasLiveFeed: boolean;
  onOpenTranscript: () => void;
  onOpenLiveFeed: () => void;
  onEdit?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
