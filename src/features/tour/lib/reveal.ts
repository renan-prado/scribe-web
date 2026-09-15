"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { TourReveal } from "@/lib/domain/tour";

/**
 * O canal pelo qual um passo pede à tela que ABRA o que ele vai explicar.
 *
 * ## Por que isto precisa existir
 *
 * Todo o resto desta pasta parte de que o alvo do passo já está na tela: o
 * holofote recorta o que está lá, e o passo cujo alvo não está é descartado
 * (ver `anchors.ts`). Isso vale para tudo — menos para o menu de criar do
 * celular, que é justamente o lugar onde as três portas do produto moram e que
 * NASCE FECHADO. Um tour que só pudesse falar do que já está aberto contaria as
 * três portas apontando para um `+`, que é a informação que a pessoa já tem.
 *
 * Então o passo declara `reveal`, e quem sabe abrir aquilo escuta. O tour não
 * conhece o `CreateDock`, e o `CreateDock` não conhece o tour: os dois conhecem
 * o nome `"create-dock"`, que mora em `lib/domain/tour.ts` com o resto do
 * vocabulário.
 *
 * ## É um evento de janela, e não contexto do React
 *
 * O `TourProvider` envolve a moldura de `(app)`, e o `CreateDock` está dentro
 * dela — um contexto funcionaria. Mas ele obrigaria toda tela que quiser ser
 * aberta por um tour a estar debaixo daquele provider, e o preço de um
 * `useSyncExternalStore` sobre um `CustomEvent` é uma linha. O valor corrente
 * fica no módulo para que quem montar no meio do caminho leia o estado certo em
 * vez de esperar o próximo evento.
 *
 * ## Quem publica é só o `TourRunner`, e ele SEMPRE limpa
 *
 * O véu some quando o tour fecha, por qualquer um dos caminhos (fim, "Pular",
 * X, Escape). Se o reveal não fosse desfeito junto, o menu ficaria aberto
 * sozinho sobre a Biblioteca, sem nada na tela explicando por quê — e é por
 * isso que a limpeza mora num efeito de desmontagem próprio, e não na volta do
 * efeito que publica: entre dois passos que pedem o MESMO reveal, uma limpeza
 * no meio fecharia e reabriria o painel a cada "Próximo".
 */

const EVENT = "scriba:tour-reveal";

/** O que está revelado AGORA. Nunca mais de um: o tour é um só, na tela toda. */
let current: TourReveal | null = null;

/** Só o `TourRunner` chama. Repetir o mesmo valor não acorda ninguém. */
export function publishTourReveal(next: TourReveal | null): void {
  if (current === next || typeof window === "undefined") return;
  current = next;
  window.dispatchEvent(new CustomEvent<TourReveal | null>(EVENT, { detail: next }));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/**
 * "O tour está pedindo para eu abrir?" — a pergunta que o `CreateDock` faz.
 *
 * No servidor a resposta é sempre `false`: o tour é uma coisa do navegador, e
 * um `true` na renderização do servidor seria uma tela que chega com o menu
 * aberto para quem nem vai ver o tour.
 */
export function useTourReveal(name: TourReveal): boolean {
  const getSnapshot = useCallback(() => current === name, [name]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
