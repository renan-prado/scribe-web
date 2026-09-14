/**
 * O chip dos controles da barra do topo: hambúrguer, voltar, lupa.
 *
 * Mora numa constante porque são QUATRO botões em quatro arquivos (`AppMenu`,
 * o voltar da `TopBar`, `SearchToggle` e `LibrarySearchLink`) desenhando o
 * mesmo objeto. Copiada, a classe divergiria no primeiro ajuste de raio ou de
 * tamanho, e a barra passaria a ter dois desenhos de botão lado a lado.
 *
 * Módulo `.ts` puro, sem `"use client"`: é uma string, então o servidor (a
 * `TopBar`) e o cliente (a lupa) leem a mesma sem nenhum custo de fronteira.
 *
 * REDONDO e de 40px, com glifo de 20px. O avatar fica ao lado, e três
 * controles na mesma barra com duas bordas diferentes liam como peças de
 * origens diferentes. O fundo é SEMPRE visível, e não um alvo transparente que
 * se acende no hover: hover não existe no celular (ver `src/shared/AGENTS.md`).
 * O anel de foco é `offset` e cor de tinta, NÃO o próprio chip — contra o fundo
 * da página o `--v2-card` dá 1,25:1, e um foco desenhado por ele seria
 * invisível exatamente para quem navega por teclado.
 */
export const TOPBAR_CHIP_CLASS =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-v2-card text-v2-ink transition-colors hover:bg-v2-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute";
