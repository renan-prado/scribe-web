"use client";

import { useEffect } from "react";
import { type CycleUsage, getCoinsState, useCoinsStore } from "@/features/coins/store";

/**
 * Quem SEMEIA o saldo de moedas na store, e quem o ressincroniza depois.
 *
 * Não desenha nada. Mora no layout de `(shell)`, que é o lugar onde o saldo
 * já chegou do servidor (`getCurrentAccount`), e por isso o semear não custa
 * requisição nenhuma: o número já estava na resposta.
 *
 * ## O defeito que ele conserta
 *
 * `balance === null` na store quer dizer "ainda não sei", e é com isso que
 * cada consumidor distingue "carregando" de "zerado". Só que o único
 * componente que semeava a store era o `CoinBalance` — o chip do saldo — e ele
 * mora DENTRO do menu da conta, que é um popup: base-ui só monta o conteúdo de
 * um `DropdownMenu` quando ele abre. Enquanto ninguém tocasse no avatar, a
 * store ficava em `null` para sempre.
 *
 * O sintoma era no `/import`: o botão "Importar" só aparece quando o saldo é
 * conhecido (é ele que decide entre o botão e o aviso de saldo insuficiente), e
 * até lá a tela desenha uma pastilha pulsando no lugar dele. Um carregando que
 * não terminava nunca, porque não havia nada carregando — e a única maneira de
 * destravá-lo era abrir o menu da conta, que ninguém tem razão para fazer
 * naquela tela. O gate da gravação lê a mesma store.
 *
 * Veio de `bf918fa`, quando o chip do saldo saiu da barra do topo (onde estava
 * sempre montado) para dentro do menu. A lição: **o que semeia estado global
 * não pode morar dentro de um popup.**
 *
 * ## Os dois sinais de ressincronia moram aqui pela mesma razão
 *
 * O pagamento acontece numa ABA NOVA (para não derrubar uma gravação em curso),
 * então esta aba não recebe evento nenhum quando o crédito entra. Dois sinais
 * cobrem o caso: a volta do FOCO, e um `postMessage` que a aba de retorno
 * dispara no `window.opener` assim que vê o saldo subir. Os dois listeners
 * também moravam no `CoinBalance`, ou seja, também só existiam com o menu
 * aberto — a ressincronia estava documentada e não acontecia.
 *
 * No layout eles são um par só para o app inteiro, e sobrevivem à navegação.
 */
export function CoinsSync({
  balance,
  cycle,
  unlimited = false,
}: {
  balance: number;
  cycle: CycleUsage | null;
  /** Conta de Backoffice (migração 0073): o saldo não vale nada e nada trava. */
  unlimited?: boolean;
}) {
  const setBalance = useCoinsStore((s) => s.setBalance);
  const setCycle = useCoinsStore((s) => s.setCycle);
  const setUnlimited = useCoinsStore((s) => s.setUnlimited);
  const refresh = useCoinsStore((s) => s.refresh);

  // O ciclo é semeado SEM guarda, ao contrário do saldo: ele não tem um
  // "ainda não sei" que trave gate nenhum, e a prop vem do mesmo render de
  // servidor que trouxe o saldo. Segurá-lo atrás da mesma condição deixaria o
  // chip do assinante no modo do saldo absoluto até o primeiro `refresh`.
  useEffect(() => {
    setCycle(cycle);
  }, [cycle, setCycle]);

  // Sem guarda, como o ciclo e pelo mesmo motivo: não há "ainda não sei" aqui
  // — o servidor já respondeu, e `false` é a resposta certa para todo mundo
  // que não é conta interna.
  useEffect(() => {
    setUnlimited(unlimited);
  }, [unlimited, setUnlimited]);

  // Só semeia o que ainda não se sabe. Este componente monta uma vez (é do
  // layout, que sobrevive à navegação), mas a guarda importa mesmo assim: a
  // prop vem de um render de SERVIDOR e pode estar velha em relação a um débito
  // que a própria aba já fez, e sobrescrever com ela devolveria à tela um saldo
  // que já foi gasto.
  useEffect(() => {
    if (getCoinsState().balance === null) setBalance(balance);
  }, [balance, setBalance]);

  useEffect(() => {
    const onFocus = () => void refresh();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === "scriba:coins-updated") {
        void refresh();
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  return null;
}
