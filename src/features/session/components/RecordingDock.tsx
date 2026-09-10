"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * As faixas fixas do rodapé durante a gravação: o alternador de visão numa,
 * a barra do gravador na outra.
 *
 * **Elas moram embaixo porque em cima não serviriam.** O conteúdo destas telas
 * cresce por uma hora, um controle no topo obrigaria a rolar o sermão inteiro
 * de volta só para trocar de aba, que é o problema que ele deveria resolver.
 * Aqui fica no alcance do polegar o tempo todo, sem depender de onde a página
 * está.
 *
 * **Duas faixas, e não uma linha só.** As abas já dividiram a linha com a barra
 * do gravador, e num telefone de 390px não cabia: a barra sozinha carrega
 * tempo, pausar, parar e descartar, e o que sobrava obrigava as abas a ficarem
 * só de ícone. Duas caixinhas mudas ao lado de um cronômetro não anunciam que
 * existe uma transcrição para ler, que é a única razão de este controle
 * existir. Empilhadas, cada uma tem a largura que precisa e os rótulos ficam.
 *
 * Sem barra de gravador (sessão parada), as abas descem para a faixa dela: uma
 * pílula flutuando acima do nada denuncia que falta alguma coisa ali.
 *
 * O `env(safe-area-inset-bottom)` é o inset do indicador de início do iPhone,
 * diferente de zero só no PWA instalado.
 *
 * A moldura de largura total é `pointer-events-none` de propósito: ela existe
 * só para centralizar, e sem isso uma faixa invisível atravessaria a tela
 * comendo o toque de quem tenta tocar num cartão do feed na mesma altura.
 */
export function RecordingDock({ tabs, control }: { tabs?: ReactNode; control?: ReactNode }) {
  return (
    <>
      {tabs ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3",
            control
              ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
          )}
        >
          <div className="pointer-events-auto max-w-full">{tabs}</div>
        </div>
      ) : null}
      {control ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
          <div className="pointer-events-auto max-w-full">{control}</div>
        </div>
      ) : null}
    </>
  );
}

/**
 * A faixa das pílulas transientes ("Ler novidades", "Acompanhar a
 * transcrição"), acima das abas. Elas aparecem só quando o usuário se afastou
 * do fim, então a ordem de baixo para cima é: o que sempre está lá primeiro, o
 * que às vezes aparece por último.
 */
export const RECORDING_TRANSIENT_BAND =
  "fixed bottom-[calc(9.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2";
