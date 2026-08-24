"use client";

import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  sessionId: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function SessionCardMenu({ sessionId, deleteAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da sessão"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-[color:var(--scriba-ink-mute)] outline-none transition-colors hover:bg-[color:var(--scriba-blue-soft)]/60 hover:text-[color:var(--scriba-ink)] focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem render={<Link href={`/recording/${sessionId}/summary`} />}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => formRef.current?.requestSubmit()}>
            <Trash2 />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form ref={formRef} action={deleteAction} className="hidden">
        <input type="hidden" name="id" value={sessionId} />
      </form>
    </>
  );
}
