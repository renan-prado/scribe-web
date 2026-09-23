"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNetworkStatus } from "@/shared/hooks/use-network-status";

/**
 * A outra metade do `OfflineBadge`: o que acontece quando a rede VOLTA.
 *
 * ## Por que ela precisa existir
 *
 * A pastilha diz "estou offline" e some sozinha quando a conexão retorna, e
 * sumir é uma informação fraca demais para o que de fato mudou. Quem ficou dez
 * minutos escrevendo sem rede não está olhando para o canto de baixo à esquerda
 * esperando um ícone desaparecer: ela está esperando alguém dizer que o
 * trabalho voltou a sair do aparelho. O aviso positivo é curto, discreto e
 * dura o tempo de um toast, mas é ele que fecha o ciclo que a pastilha abriu.
 *
 * E o aviso sozinho ainda seria só uma frase. O que ele anuncia é a
 * REIDRATAÇÃO que acontece junto:
 *
 * - `invalidateQueries()` sem filtro marca tudo como velho, e o TanStack
 *   refaz as queries ATIVAS, que são as da tela em que a pessoa está. O resto
 *   se resolve quando for montado. Sem isso a Biblioteca continuaria mostrando
 *   o que o disco guardou antes da queda até alguém recarregar a página.
 * - `resumePausedMutations()` é a rede embaixo do `networkMode`: hoje ele é
 *   `offlineFirst` e nenhuma mutação fica pausada (ver `Providers`), mas a
 *   chamada custa nada e é o que impede uma escrita presa de ficar presa para
 *   sempre no dia em que esse modo mudar.
 * - `router.refresh()` é a metade SERVIDOR. As telas do app são server
 *   components, e nada do TanStack alcança o que veio no HTML — o saldo de
 *   moedas na barra, por exemplo. Sem ele, voltar a ter rede deixaria a
 *   moldura com os números de antes da queda.
 *
 * Tudo isso junto é o que substitui o "recarregue a página" que o produto não
 * quer pedir.
 *
 * ## Por que um `ref` e não só o booleano
 *
 * Porque o que dispara não é "estar online", é a TRANSIÇÃO. `useNetworkStatus`
 * nasce `true` no servidor e no primeiro quadro do cliente (ver o cabeçalho
 * dele), então reagir ao valor faria toda abertura do app começar com um
 * "conexão restabelecida" para quem nunca a perdeu.
 *
 * ## Onde ela mora
 *
 * No layout de `(shell)`, ao lado do `OfflineBadge`, e pelo mesmo motivo: o
 * estado é do APARELHO e não da página, e repetido em sete telas bastaria
 * esquecer uma para o aviso sumir justamente onde alguém estava trabalhando.
 */
export function ReconnectWatcher(): null {
  const online = useNetworkStatus();
  const client = useQueryClient();
  const router = useRouter();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    toast.success("Conexão restabelecida");
    void client.invalidateQueries();
    void client.resumePausedMutations();
    router.refresh();
  }, [online, client, router]);

  return null;
}
