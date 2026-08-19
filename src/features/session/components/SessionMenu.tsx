import { FileText, Headphones, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SessionMenu({
  hasTranscript,
  hasAudio,
  onOpenTranscript,
  onOpenAudio,
}: {
  hasTranscript: boolean;
  hasAudio: boolean;
  onOpenTranscript: () => void;
  onOpenAudio: () => void;
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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={!hasTranscript} onClick={onOpenTranscript} className="gap-2">
          <FileText className="size-4" />
          Ler transcrição
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasAudio} onClick={onOpenAudio} className="gap-2">
          <Headphones className="size-4" />
          Áudio completo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
