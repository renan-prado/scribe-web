"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * Recarrega os números do painel sem recarregar a página.
 *
 * `router.refresh()` refaz o server component e troca só o que mudou — o
 * estado do cliente (aba aberta, rolagem) sobrevive. Um F5 perderia os dois.
 *
 * Existe porque o funil tem defasagem de horas: o parceiro publica, manda o
 * link no grupo e volta para a aba já aberta esperando ver o número subir. Sem
 * botão, a única saída visível é recarregar a página.
 */
export function RefreshPanelButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-scriba-hairline-soft bg-scriba-paper px-3 py-1.5",
        "text-[12px] font-medium text-scriba-ink-soft transition-colors",
        "hover:border-scriba-blue-soft hover:text-scriba-ink-strong",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-progress disabled:opacity-70"
      )}
    >
      <RotateCw className={cn("size-3.5", isPending && "animate-spin")} aria-hidden />
      {isPending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
