"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Recarrega os números da tela do painel sem recarregar a página.
 *
 * Mora na FAIXA DO TOPO, e por isso vale para as onze telas do `/admin` sem
 * uma linha em cada uma: todas elas são server component com
 * `dynamic = "force-dynamic"`, então `router.refresh()` refaz a consulta e
 * troca só o que mudou — a sidebar, a rolagem e o estado dos formulários
 * sobrevivem, o que um F5 perderia. É o mesmo mecanismo do
 * `RefreshPanelButton` do painel do parceiro, com a roupa dos outros botões
 * desta faixa.
 *
 * Ele existe porque o painel é lido em aba aberta: dado de admin muda por fora
 * (um webhook do Stripe, um pré-cadastro, um evento de uso), e sem botão a
 * única saída visível é recarregar a página inteira.
 *
 * É só o glifo, como o Sair: a faixa divide a largura com o breadcrumb, e no
 * celular cada rótulo a mais empurra o caminho da tela para fora.
 */
export function AdminRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label={isPending ? "Atualizando os dados" : "Atualizar os dados"}
      className="disabled:cursor-progress disabled:opacity-70"
    >
      <RotateCw className={cn(isPending && "animate-spin")} />
    </Button>
  );
}
