import type { TourKey } from "@/lib/domain/tour";

/**
 * As três chamadas do tour, do lado do navegador.
 *
 * As duas primeiras FALHAM EM SILÊNCIO por desenho: o tour é a explicação de
 * uma tela que já funciona sozinha, e um erro de rede na explicação não pode
 * virar um toast vermelho sobre o conteúdo que a pessoa veio ver. O que se
 * perde é uma apresentação; o que se protege é a leitura.
 *
 * `resetTours` é a exceção, e por isso devolve `boolean`: ali foi a pessoa que
 * clicou, e um clique que não faz nada e não avisa é pior que um botão que não
 * existe.
 */

/**
 * "Posso mostrar este tour agora?". A resposta `true` já veio gravada no
 * servidor, ver `/api/tour/start`. Um `false` é o caminho normal para quem já
 * viu, e também a resposta da segunda aba quando duas abrem a mesma tela.
 */
export async function startTour(tour: TourKey): Promise<boolean> {
  try {
    const res = await fetch("/api/tour/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tour }),
    });
    if (!res.ok) return false;
    const payload = (await res.json()) as { run?: boolean };
    return payload?.run === true;
  } catch {
    return false;
  }
}

/**
 * O desfecho. Não muda se o tour volta, isso já foi decidido no `start`; serve
 * para sabermos ONDE as pessoas desistem.
 *
 * Usa `sendBeacon` quando disponível porque o caminho mais comum de abandono é
 * a aba sendo fechada, e um `fetch` disparado no `pagehide` é cancelado com
 * ela. `keepalive` é o plano B do navegador que não tem beacon.
 */
export function finishTour(input: {
  tour: TourKey;
  step: number;
  outcome: "completed" | "dismissed";
}): void {
  const body = JSON.stringify(input);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/tour/finish", blob)) return;
    }
    void fetch("/api/tour/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ver o cabeçalho: o desfecho é telemetria de produto, não o produto.
  }
}

/** "Rever os tours" do /profile. `true` quando as linhas foram apagadas. */
export async function resetTours(): Promise<boolean> {
  try {
    const res = await fetch("/api/tour/reset", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
