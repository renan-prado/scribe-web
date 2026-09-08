import { BOOK_ABBREVS, normalizeBookName } from "@/lib/bibles/books";
import { parseVerseReference } from "@/lib/domain/feed";

/**
 * Entender "Jonas 1" como REFERÊNCIA, e não como duas palavras soltas.
 *
 * A busca das listas casa texto: título, resumo curto, autor, local e — pela
 * rota — a transcrição. Um versículo citado não é nenhuma dessas coisas. Ele é
 * um card (`citedVerse`, projetado em `session_feed_items`) ou um bloco
 * `bibleQuote` do resumo, e a única forma de reencontrá-lo é comparar
 * REFERÊNCIA com REFERÊNCIA — livro, capítulo, faixa de versículos —, não
 * string com string.
 *
 * Comparar string com string falha em todas as pontas ao mesmo tempo:
 *
 * - **A grafia.** O que está gravado é o que o modelo escreveu: "Jonas 1:1-17",
 *   "Jn 1", "Gênesis 1:1". Quem procura escreve "jonas 1", "1co 13", "genesis"
 *   sem acento. `ilike '%jonas 1%'` erra as três.
 * - **A granularidade.** Quem procura "Jonas 1" quer o card que diz
 *   "Jonas 1:1-17". Quem procura "Jonas 1:3" quer esse mesmo card, porque o 3
 *   está dentro da faixa. Nenhum dos dois é substring do outro.
 * - **O capítulo inteiro.** "João 4" (sem versículo) cobre qualquer versículo
 *   de João 4 que alguém venha a procurar.
 *
 * Este módulo é client-safe de propósito (só `lib/bibles/books.ts`, que é
 * tabela em memória): a rota o usa para montar a consulta e para conferir o
 * que voltou, e nada impede a lista de usá-lo um dia sem ida ao servidor.
 */

export type ReferenceQuery = {
  /** Livro canônico — a abreviação da NVI, `Jn` para Jonas. */
  abbrev: string;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
  /**
   * Grafias normalizadas (minúsculas, sem acento) que o banco pode ter gravado
   * para ESTE livro: todos os apelidos que apontam para a abreviação, mais a
   * própria. Vai como igualdade em `session_feed_items.verse_book`.
   */
  books: string[];
  /** As mesmas grafias como prefixo LIKE, para casar a referência CRUA dos
   *  blocos do resumo ("jonas 1:1-17" começa com "jonas"). */
  prefixes: string[];
};

/** abreviação → todos os apelidos de `BOOK_ABBREVS` que levam a ela. */
const ALIASES_BY_ABBREV = ((): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const [alias, abbrev] of Object.entries(BOOK_ABBREVS)) {
    const list = map.get(abbrev);
    if (list) list.push(alias);
    else map.set(abbrev, [alias]);
  }
  // A própria abreviação é grafia possível: o modelo escreve "Jn 1" às vezes, e
  // o `verse_book` do banco guarda o que ele escreveu.
  for (const [abbrev, list] of map) {
    const normalized = normalizeBookName(abbrev);
    if (!list.includes(normalized)) list.push(normalized);
  }
  return map;
})();

/**
 * Grafia normalizada → abreviação, incluindo as abreviações como entrada.
 *
 * **`BOOK_ABBREVS` entra PRIMEIRO e nunca é sobrescrito.** A normalização tira
 * o acento, e aí "Jó" e a abreviação "Jo" (João) viram a mesma chave — colisão
 * que o `books.ts` já resolveu de propósito, mandando "jo" para Jó. Deixar a
 * abreviação derivada vencer reabriria a decisão em silêncio, do lado errado:
 * quem procura "Jó 3" receberia João 3.
 */
const ABBREV_BY_NAME = ((): Map<string, string> => {
  const map = new Map<string, string>(Object.entries(BOOK_ABBREVS));
  for (const [abbrev, aliases] of ALIASES_BY_ABBREV) {
    for (const alias of aliases) {
      if (!map.has(alias)) map.set(alias, abbrev);
    }
  }
  return map;
})();

/**
 * O livro que o usuário quis dizer, ou `null`.
 *
 * Três tentativas, da mais segura para a mais generosa. O prefixo ("jona",
 * "apoca") só vale a partir de três letras e só quando UM livro responde: com
 * dois candidatos a busca escolheria por conta própria, e escolher errado é
 * pior que não achar — o usuário reescreve o que digitou, mas não desconfia de
 * um resultado que parece certo.
 */
export function resolveBookAbbrev(raw: string): string | null {
  const name = normalizeBookName(raw);
  if (!name) return null;

  const exact = ABBREV_BY_NAME.get(name);
  if (exact) return exact;

  // "1co" / "2tm": o usuário cola a abreviação sem o espaço que ela tem aqui.
  const tight = name.replace(/\s+/g, "");
  for (const [alias, abbrev] of ABBREV_BY_NAME) {
    if (alias.replace(/\s+/g, "") === tight) return abbrev;
  }

  if (name.length < 3) return null;
  let found: string | null = null;
  for (const [alias, abbrev] of ABBREV_BY_NAME) {
    if (!alias.startsWith(name)) continue;
    if (found && found !== abbrev) return null;
    found = abbrev;
  }
  return found;
}

/**
 * `Jonas`, `Jonas 1`, `jonas 1:3`, `jonas 1.3-5`, `1co 13` → consulta.
 *
 * Os números ficam ancorados no FIM justamente porque metade dos livros começa
 * com um: em "1 corintios" o 1 é do nome, em "1co 13" o 13 é do capítulo. Quem
 * decide não é a posição do dígito, é o que sobra quando os números finais
 * saem — e o que sobra tem de ser um livro conhecido, senão isto aqui não é
 * uma referência e a busca segue sendo textual.
 */
export function parseReferenceQuery(raw: string): ReferenceQuery | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const m = /^(.+?)\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?$/.exec(cleaned);
  const bookRaw = m ? m[1] : cleaned;
  const abbrev = resolveBookAbbrev(bookRaw);
  if (!abbrev) return null;

  const aliases = ALIASES_BY_ABBREV.get(abbrev) ?? [];
  const startVerse = m?.[3] ? Number.parseInt(m[3], 10) : undefined;
  const endVerse = m?.[4] ? Number.parseInt(m[4], 10) : startVerse;

  return {
    abbrev,
    chapter: m ? Number.parseInt(m[2], 10) : undefined,
    startVerse,
    endVerse,
    books: aliases,
    prefixes: aliases.map((a) => `${a}%`),
  };
}

/**
 * A referência gravada atende à consulta?
 *
 * Regra de faixa: as duas se INTERSECTAM, não uma contém a outra. Procurar
 * "Jonas 1:3" tem de achar o card "Jonas 1:1-17", e procurar "Jonas 1:1-17"
 * tem de achar o card "Jonas 1:3" — o pregador leu um pedaço, o usuário lembra
 * do outro.
 *
 * Referência sem versículo (capítulo inteiro) casa com qualquer versículo
 * daquele capítulo, dos dois lados: é o que "João 4" significa.
 */
export function referenceMatchesQuery(reference: string, query: ReferenceQuery): boolean {
  const parsed = parseVerseReference(reference);
  if (!parsed) {
    // Referência sem capítulo nenhum ("Jonas"): só casa consulta sem capítulo.
    return resolveBookAbbrev(reference) === query.abbrev && query.chapter == null;
  }
  if (resolveBookAbbrev(parsed.bookDisplay) !== query.abbrev) return false;
  if (query.chapter == null) return true;
  if (parsed.chapter !== query.chapter) return false;
  if (query.startVerse == null || parsed.startVerse == null) return true;

  const queryEnd = query.endVerse ?? query.startVerse;
  const refEnd = parsed.endVerse ?? parsed.startVerse;
  return query.startVerse <= refEnd && queryEnd >= parsed.startVerse;
}
