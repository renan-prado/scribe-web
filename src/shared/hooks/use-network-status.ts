"use client";

import { useSyncExternalStore } from "react";

/**
 * Há rede agora?
 *
 * É o único lugar do produto que responde isso, e a razão de ele existir é que
 * a resposta estava espalhada: `navigator.onLine` aparecia solto em quatro
 * arquivos, cada um com a sua guarda de `typeof navigator`, e nenhum deles
 * repintava a tela quando a resposta mudava — eram leituras pontuais, no
 * instante de uma falha. Uma tela que precise DIZER "você está sem internet"
 * não pode ser servida por isso.
 *
 * ## O que `navigator.onLine` realmente significa
 *
 * "A máquina tem uma interface de rede ativa", e nada mais. Ele diz `true` num
 * wi-fi de hotel que não deixa passar um pacote, e pode dizer `false` numa VPN
 * que está funcionando perfeitamente. **Então ele é uma DICA, nunca a decisão.**
 *
 * A consequência prática vale para todo consumidor daqui: use-o para escolher a
 * FRASE ("sem internet" contra "erro ao salvar"), para adiantar um trabalho que
 * certamente falharia, e para saber a hora de tentar de novo. Nunca para
 * decidir se vale a pena tentar: quem decide isso é a resposta do servidor.
 * `capture-upload.ts` é o exemplo de como isso fica no código.
 *
 * ## Por que `useSyncExternalStore`
 *
 * Porque a resposta é um dado EXTERNO ao React, que muda sozinho, e este hook é
 * usado em mais de um lugar ao mesmo tempo. Com `useState` + `useEffect` seriam
 * N assinaturas dos mesmos dois eventos e N cópias do mesmo booleano, que é
 * exatamente o tipo de coisa que diverge por um quadro.
 *
 * **O snapshot do SERVIDOR é `true`, sempre**, e essa é a decisão que evita um
 * defeito de hidratação: o HTML é montado sem saber nada do aparelho, e se ele
 * nascesse "offline" toda página apareceria com o aviso por um quadro antes de
 * se corrigir. Otimista no servidor, verdadeiro no cliente logo depois.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine !== false;
}

/** No servidor não há aparelho para perguntar. Ver o cabeçalho. */
function getServerSnapshot(): boolean {
  return true;
}

/** `true` enquanto o navegador achar que há rede. Ver as ressalvas acima. */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * A mesma pergunta FORA do React, para quem não está num componente.
 *
 * A fila de gravações e o salvamento do editor perguntam isso dentro de uma
 * função assíncrona, onde não há hook que valha. Ter os dois caminhos no mesmo
 * arquivo é o que impede a guarda de `typeof navigator` de ser reescrita de um
 * jeito diferente em cada chamador.
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
