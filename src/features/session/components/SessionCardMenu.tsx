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
  /** Página da sessão salva, /summary nos modos com resumo, /transcript no
   * modo transcrição. */
  href: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function SessionCardMenu({ sessionId, href, deleteAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da sessão"
          // A TINTA VEM DO CARTÃO, por herança (`text-current`), e não de um
          // token próprio: o post-it que o hospeda pode ser claro ou escuro
          // (ver `LibraryNote`), e um `text-scriba-ink-mute` fixo daria um
          // glifo quase branco sobre papel de limão. Pelo mesmo motivo o realce
          // é preto translúcido, que escurece qualquer das quatro faces, em vez
          // de uma cor de superfície que só serve a uma delas.
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-current outline-none transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem render={<Link href={href} />}>
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
