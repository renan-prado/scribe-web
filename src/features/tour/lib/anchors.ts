import type { TourStep } from "@/lib/domain/tour";

/**
 * Achar o elemento de que um passo fala, e decidir se ele conta.
 *
 * ## Por que "o primeiro VISÍVEL" e não "o primeiro"
 *
 * Metade dos alvos do produto é desenhada duas vezes: o botão "Gravar" existe
 * no header do desktop E na barra do celular, o `SessionMenu` aparece na tela
 * de gravação e na de resumo. Quem esconde um dos dois é `sm:hidden` /
 * `hidden sm:flex`, ou seja, `display: none`, e um `querySelector` cru
 * devolveria o que está fora da tela na metade das vezes. O holofote então
 * recortaria um retângulo de tamanho zero no canto superior esquerdo, sem erro
 * nenhum no console.
 *
 * Um elemento com `display: none` não tem caixa, e é isso que este módulo
 * mede. Não é uma conferência de "está dentro da janela": um alvo que existe
 * mas está rolado para fora da tela É um alvo válido, o tour rola até ele.
 */

const MIN_ANCHOR_SIZE = 4;

/** O elemento do passo, ou `null`. Passo sem `anchor` é sempre `null`. */
export function resolveAnchor(selector: string | undefined): HTMLElement | null {
  if (!selector || typeof document === "undefined") return null;
  let matches: NodeListOf<Element>;
  try {
    matches = document.querySelectorAll(selector);
  } catch {
    // Seletor inválido é erro de quem escreveu o passo, e o preço dele é o
    // passo sumir, não a tela quebrar.
    return null;
  }
  for (const el of matches) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_ANCHOR_SIZE || rect.height < MIN_ANCHOR_SIZE) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    return el;
  }
  return null;
}

/**
 * Os passos que esta tela, AGORA, tem como mostrar.
 *
 * Passo sem âncora entra sempre: ele fala da tela, não de um elemento. Passo
 * com âncora só entra se o elemento estiver lá, e o motivo está no cabeçalho
 * de `lib/domain/tour.ts`: metade dos alvos é condicional (a faixa "Em
 * aberto", o botão de gerar estudo de quem já gerou), e um tour que travasse
 * no alvo ausente seria um tour que só funciona na conta de quem o escreveu.
 *
 * Lista vazia significa "esta tela não tem o que mostrar ainda", e quem chama
 * NÃO registra nada nesse caso: o tour espera a próxima visita.
 */
export function resolveSteps(steps: readonly TourStep[]): TourStep[] {
  return steps.filter((step) => !step.anchor || resolveAnchor(step.anchor) !== null);
}
