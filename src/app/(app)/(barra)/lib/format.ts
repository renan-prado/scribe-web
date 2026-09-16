/**
 * Formatador do v2.
 *
 * Ele vive aqui, e não em `src/features/session/lib/formatting.ts`, porque diz
 * uma coisa DIFERENTE da de lá com os mesmos dados, e mexer numa não pode mexer
 * na outra:
 *
 * `monthGroupLabel` agrupa só por MÊS ("Este mês", "Abril"); o `groupLabel` do
 * app atual começa por semana ("Esta semana", "Semana passada"), que é outro
 * desenho de lista. O resto do que o v2 formata (data, duração) vem de lá
 * mesmo, pelo cartão: `SessionCard` é o mesmo nas duas telas.
 */

const MONTHS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "Este mês" / "Abril" / "Abril 2024", o cabeçalho de cada bloco da lista. */
export function monthGroupLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (d.getFullYear() === now.getFullYear()) {
    if (d.getMonth() === now.getMonth()) return "Este mês";
    return MONTHS_LONG[d.getMonth()];
  }
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
