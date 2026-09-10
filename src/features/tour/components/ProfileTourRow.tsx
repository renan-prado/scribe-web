"use client";

import { Compass, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { resetTours } from "@/features/tour/lib/api";

/**
 * "Rever os tours" no /profile.
 *
 * É o troco de duas decisões desta pasta, e por isso não é um extra opcional.
 * A primeira é o tour ser gravado no instante em que aparece, o que deixa de
 * fora quem recarregou a página no primeiro passo. A segunda é ele ser uma vez
 * na vida: quem voltou depois de seis meses não tem outro caminho de volta
 * para a explicação.
 *
 * Fica ao lado de "Dar feedback" e de "Indique a um amigo", e pela mesma
 * razão: as três são coisas que a pessoa FAZ, não informações da conta.
 *
 * Apaga as linhas e recarrega a página. Recarregar não é preguiça, é o
 * necessário: o mapa do que já foi visto desce do layout do servidor, e sem
 * uma volta ao servidor o navegador continuaria achando que a pessoa viu tudo
 * até ela fechar a aba.
 */
export function ProfileTourRow() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const ok = await resetTours();
    if (!ok) {
      setPending(false);
      toast.error("Não consegui liberar os tours. Tente de novo.");
      return;
    }
    toast.success("Pronto. As apresentações voltam nas próximas telas.");
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex w-full items-center gap-3.5 rounded-[28px] bg-scriba-paper p-5 text-left ring-1 ring-scriba-hairline outline-none transition-colors hover:bg-scriba-surface focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 sm:p-6"
    >
      <span className="flex size-11 flex-none items-center justify-center rounded-2xl bg-scriba-blue-soft text-scriba-blue-ink">
        <Compass aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-scriba-ink-strong">Rever os tours</span>
        <span className="text-xs font-light leading-relaxed text-scriba-ink-soft">
          As apresentações de cada tela aparecem uma vez só. Isto traz todas de volta, do começo.
        </span>
      </span>
      <RotateCcw aria-hidden className="size-4 flex-none text-scriba-ink-mute" />
    </button>
  );
}
