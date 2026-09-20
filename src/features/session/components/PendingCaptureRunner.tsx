"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useCaptureQueue } from "../capture-queue";
import { libraryKey, useSessionOwner } from "../query";

/**
 * Quem acorda a fila das gravações guardadas. Não desenha nada.
 *
 * Ele mora no layout de `(barra)`, e não numa página, por uma razão só: uma
 * gravação que não subiu precisa continuar tentando enquanto o app estiver
 * aberto, esteja a pessoa na Biblioteca, num resumo ou no perfil. Montado numa
 * página, ele morreria no primeiro toque num cartão, que é exatamente o gesto
 * de quem acabou de ver o aviso e foi olhar outra coisa.
 *
 * É também o ÚNICO montador da fila: o `scan()` inicial acontece aqui, uma vez
 * por carregamento do app, e é ele que varre o disco atrás do que ficou de uma
 * visita anterior. Resgate silencioso quer dizer isto, e nada mais: a pessoa
 * abre o app, e o que ficou para trás vai embora sozinho sem ela pedir.
 *
 * **Cada sinal é um motivo diferente para tentar**, e é por isso que são
 * quatro e não um (ver o cabeçalho de `capture-queue.ts`). O `kick()` é barato
 * e sai na hora quando não há nada vencido, então pedi-lo de todo lado custa
 * uma comparação de números.
 *
 * O `done` é a ponte para o resto do app: quando uma gravação vira resumo aqui
 * atrás, a lista da Biblioteca está desatualizada em todo aparelho que a tiver
 * em cache. Invalidar a chave é o que faz o post-it novo aparecer sem a pessoa
 * recarregar nada. Quem NAVEGA para o resumo é a tela de gravação, e só para a
 * gravação que ela mesma acabou de encerrar: empurrar alguém que está lendo um
 * sermão para outra tela porque a fila terminou um envio de fundo seria o app
 * tomando o volante.
 */
export function PendingCaptureRunner() {
  const client = useQueryClient();
  const userId = useSessionOwner();
  const scan = useCaptureQueue((s) => s.scan);
  const kick = useCaptureQueue((s) => s.kick);
  const done = useCaptureQueue((s) => s.done);

  useEffect(() => {
    void scan().then(() => kick());
  }, [scan, kick]);

  useEffect(() => {
    const wake = () => void kick();
    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisible);
    // O desempate dos outros três, que mentem em WebView. Ele só pergunta se
    // já venceu a espera daquela gravação; não é uma tentativa a cada 20s.
    const timer = window.setInterval(wake, 20_000);
    return () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [kick]);

  // O `done` é um fato com hora, e não um pulso: ele fica no store para a tela
  // de gravação poder lê-lo mesmo montando um quadro depois. Por isso este
  // efeito guarda o que já tratou, em vez de limpar o estado de todo mundo.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!done || handled.current === done.captureId) return;
    handled.current = done.captureId;
    void client.invalidateQueries({ queryKey: libraryKey(userId) });
    // Uma que terminou libera a próxima da fila na hora, sem esperar o relógio.
    void kick();
  }, [done, client, userId, kick]);

  return null;
}
