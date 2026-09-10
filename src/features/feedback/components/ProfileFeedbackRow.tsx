"use client";

import { ChevronRight, MessageSquareHeart } from "lucide-react";
import { useState } from "react";
import { FeedbackDialog } from "@/features/feedback/components/FeedbackDialog";
import { FEEDBACK_TOPICS_BY_SURFACE } from "@/lib/domain/feedback";

/**
 * "Dar feedback" no /profile, a porta que a própria pessoa procura.
 *
 * Ela existe porque as três janelas automáticas (1ª, 3ª e 8ª gravação) são
 * NOSSA escolha de momento, e o momento em que alguém tem algo a dizer é dela.
 * Sem este botão, quem se incomodou na décima gravação não tem para onde
 * levar isso, e essa é exatamente a pessoa que ainda está aqui.
 *
 * Não passa por `feedback_prompts`: não há marco a queimar nem pergunta a
 * marcar como respondida, e por isso o envio vai sem `promptId`. O servidor
 * trata a ausência dele como o feedback geral, tópico `overall`, sem sessão.
 *
 * Fica ao lado de "Indique a um amigo" e com a mesma forma de propósito: as
 * duas são coisas que a pessoa FAZ pelo produto, não informações da conta.
 */
export function ProfileFeedbackRow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3.5 rounded-[28px] bg-scriba-paper p-5 text-left ring-1 ring-scriba-hairline outline-none transition-colors hover:bg-scriba-surface focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-6"
      >
        <span className="flex size-11 flex-none items-center justify-center rounded-2xl bg-scriba-mint text-scriba-mint-accent">
          <MessageSquareHeart aria-hidden className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-scriba-ink-strong">Dar feedback</span>
          <span className="text-xs font-light leading-relaxed text-scriba-ink-soft">
            Conte o que está bom e o que atrapalha. Levamos um minuto para ler, e é o que decide o
            que vem depois.
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 flex-none text-scriba-ink-mute" />
      </button>

      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        surface="general"
        topics={FEEDBACK_TOPICS_BY_SURFACE.general}
      />
    </>
  );
}
