/**
 * A busca das listas — `/recordings` e `/studies`. Helpers PUROS e
 * client-safe: a filtragem roda no navegador, sobre a lista que a página já
 * entregou.
 *
 * ## Por que no cliente
 *
 * As duas páginas já carregam TODAS as sessões (e todos os estudos) do usuário
 * num render de servidor — não há paginação em lugar nenhum, e a escala é a de
 * quem grava um ou dois sermões por semana. Filtrar isso no cliente responde
 * instantaneamente a cada tecla, sem uma ida ao servidor por caractere e sem
 * um estado de carregamento piscando entre os cartões.
 *
 * A exceção é o texto da PREGAÇÃO: transcrição não vem nas listas (é uma das
 * três colunas pesadas, ver `SELECT_LIST` em `lib/db/sessions.ts`) e não pode
 * vir — trazer uma hora de sermão por cartão para desenhar uma lista seria
 * trocar a busca por um problema pior. Quem procura uma FRASE dita no púlpito
 * passa por `/api/sessions/search`, e os ids que voltam entram na mesma
 * peneira. Ver `useContentSearch`.
 *
 * ## O casamento
 *
 * Sem acento, sem caixa, por TOKEN e conjuntivo: "paulo roma" acha "Paulo em
 * Roma" e "Roma, por Paulo", e não acha o que só tem uma das duas. É o
 * comportamento que todo campo de busca tem, e o que o usuário assume sem
 * ninguém explicar. Fuzzy de verdade (distância de edição) foi deixado de
 * fora de propósito: com dezenas de itens ele acha coisas que a pessoa não
 * pediu, e o custo de um typo aqui é apagar uma letra.
 */

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Os termos da consulta, normalizados, sem vazios e sem repetição. */
export function searchTokens(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalizeSearch(query).split(/\s+/)) {
    if (raw) seen.add(raw);
  }
  return [...seen];
}

/**
 * Todo termo precisa aparecer em algum lugar do palheiro. `haystack` já vem
 * normalizado por quem chama — normalizar aqui repetiria o trabalho a cada
 * tecla, para cada cartão da lista.
 */
export function matchesAllTokens(normalizedHaystack: string, tokens: string[]): boolean {
  return tokens.every((t) => normalizedHaystack.includes(t));
}

/** Junta os campos pesquisáveis de um item num palheiro normalizado só. */
export function buildHaystack(parts: (string | null | undefined)[]): string {
  return normalizeSearch(parts.filter(Boolean).join("  "));
}

/* -------------------------------------------------------------------------- */
/* Período                                                                     */
/* -------------------------------------------------------------------------- */

export const DATE_RANGE_KEYS = ["all", "7d", "30d", "90d", "12m"] as const;
export type DateRangeKey = (typeof DATE_RANGE_KEYS)[number];

/**
 * Janelas ROLANTES, e não "este mês" / "mês passado".
 *
 * A lista já é agrupada por mês (`groupLabel`), então um filtro de mês
 * calendário só repetiria o que a rolagem resolve. O que a busca precisa
 * responder é "o que ouvi ULTIMAMENTE", e essa pergunta é relativa a hoje.
 */
export const DATE_RANGES: { value: DateRangeKey; label: string; days: number | null }[] = [
  { value: "all", label: "Qualquer data", days: null },
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 3 meses", days: 90 },
  { value: "12m", label: "Últimos 12 meses", days: 365 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isWithinRange(iso: string, range: DateRangeKey, now: Date): boolean {
  const days = DATE_RANGES.find((r) => r.value === range)?.days ?? null;
  if (days === null) return true;
  // A partir do INÍCIO do dia de N dias atrás: "últimos 7 dias" com corte no
  // instante atual deixaria de fora o sermão de domingo de manhã na segunda à
  // noite, que é exatamente o que se está procurando.
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return new Date(iso).getTime() >= start.getTime() - (days - 1) * DAY_MS;
}

/* -------------------------------------------------------------------------- */
/* Opções de autor / local                                                     */
/* -------------------------------------------------------------------------- */

/**
 * As opções de um filtro saem dos ITENS da lista, não das tabelas `speakers` /
 * `locations`. Duas razões: um filtro que oferece um nome sem nenhum resultado
 * atrás é um beco, e o snapshot em `sessions.speaker_name` é o que a lista
 * mostra — renomear um pregador não reescreve o passado (ver o cabeçalho de
 * `lib/db/speakers.ts`), então filtrar pela entidade não casaria com o texto na
 * tela.
 *
 * Ordenado por frequência e depois por nome: quem grava toda semana com o mesmo
 * pregador o encontra no topo.
 */
export function facetOptions(values: (string | null | undefined)[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const name = raw?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([name]) => name);
}

/** Rótulo do resultado: "3 de 24 gravações". Plural inline, sem i18n. */
export function resultLabel(shown: number, total: number, noun: [string, string]): string {
  const [one, many] = noun;
  if (shown === total) return `${total} ${total === 1 ? one : many}`;
  return `${shown} de ${total} ${total === 1 ? one : many}`;
}
