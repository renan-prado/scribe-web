import { LIVROS_BIBLICOS } from "@/features/session/lib/transcription/vocabulario";
import { BOOK_CANON } from "@/lib/bibles/books";
import type { LexiconCategory, LexiconIndexEntry } from "@/lib/domain/lexicon";

/**
 * Quebra um parágrafo em pedaços anotados, para o `RichText` desenhar
 * referência bíblica clicável e nome próprio marcado no meio da prosa.
 *
 * Client-safe e SEM IA: é varredura de regex sobre um léxico curado. Uma etapa
 * de LLM para "marcar as entidades" seria mais uma chamada por sessão, com
 * custo, latência e a chance de o modelo marcar coisa que não está no texto,
 * para um problema que um autômato resolve, com o mesmo resultado toda vez.
 *
 * ## O léxico ENTRA, não é importado
 *
 * Ele já foi um array compilado aqui dentro (`lib/domain/lexicon.ts`, ~330
 * strings). Hoje é cadastro (`lexicon_entries`, migração 0063) e chega por
 * parâmetro, porque quem sabe ler o banco é o servidor e quem chama esta função
 * é o render. Quem entrega a lista até aqui é o `LexiconProvider`; ver
 * `RichText`.
 *
 * **Lista vazia é um caso normal**, não um defeito: a landing não tem provedor
 * (e não vai ao banco por causa de um mockup), e o `asStandaloneScripture`
 * abaixo só se interessa por referência. Nos dois, a passada de nomes
 * simplesmente não roda.
 *
 * ## Duas passadas, nesta ordem
 *
 * 1. **Referência bíblica.** Exige NÚMERO de capítulo: "João 3:16" e "Romanos 8"
 *    casam, "João" sozinho não. É o que separa o evangelho do apóstolo, e é
 *    por isso que esta passada vem primeiro: ela consome "João 3:16" inteiro,
 *    e a passada de nomes nunca chega a ver aquele "João". A lista de LIVROS
 *    continua em código, e não no cadastro: ela é fechada há dois mil anos.
 * 2. **Nome próprio**, só nos vãos que sobraram da primeira.
 *
 * ## A ABREVIAÇÃO é reconhecida, e ela exige VERSÍCULO
 *
 * "1Tm 4:12", "At 16:1", "Fp 2:19-22" — é como se escreve referência num texto
 * denso, e sem isso um cartão do léxico fica com uma dúzia de referências
 * mortas no meio da prosa.
 *
 * **Mas ela não aceita capítulo solto, e a razão não é gosto.** Dezesseis das
 * 66 abreviações são palavras do português (`Os`, `Na`, `Am`, `Ed`, `Is`, `At`,
 * `Jd`…), e com capítulo solto "**Os** 12 discípulos" viraria Oseias 12 e
 * "**Na** 2 vezes" viraria Naum 2 — um link errado no meio de uma frase certa,
 * que é pior que link nenhum. Exigir os dois-pontos separa os dois casos com
 * precisão: medido sobre um cartão real, a regra pega as onze referências de
 * verdade e recusa os cinco falsos positivos.
 *
 * O preço é conhecido: "Ap 21" continua texto. Quem escreve capítulo inteiro
 * escreve o nome por extenso, que é o caminho que sempre funcionou.
 *
 * **O que casa e o que ABRE são coisas diferentes**, e é o `AnnotatedSegment`
 * que já separava as duas: `text` é "1Tm 4:12", como está escrito, e
 * `reference` é "1 Timóteo 4:12", que é o que `/api/verse` entende. Sem essa
 * expansão o link abriria e não acharia o texto, porque o lookup resolve nome
 * de livro, não sigla.
 *
 * ## Por que não `\b`
 *
 * O `\b` do JavaScript é ASCII: em "José." a fronteira entre `é` e `.` não
 * existe, porque nenhum dos dois é caractere de palavra para o motor de regex.
 * Um `\bJosé\b` simplesmente não casa no fim de uma frase. A direita é
 * resolvida com lookahead sobre uma classe de letras explícita; a esquerda é
 * conferida no código, olhando o caractere anterior, `lookbehind` resolveria
 * em uma linha, mas construir a RegExp lançaria em navegador antigo, e um
 * throw no import em branco a página inteira.
 */

export type AnnotatedSegment =
  | { kind: "text"; text: string }
  /** Referência com capítulo (e talvez versículo). `reference` é o que vai para o diálogo. */
  | { kind: "scripture"; text: string; reference: string }
  /**
   * Um nome do léxico. `slug` é o que o cartão abre: ele vem da ENTRADA, não do
   * texto casado, então "Lutero" e "Martinho Lutero" levam ao mesmo lugar.
   */
  | { kind: "name"; text: string; slug: string; category: LexiconCategory };

/** Classe de letra (com acento) usada nas fronteiras de palavra. */
const LETTER = "A-Za-zÀ-ÖØ-öø-ÿ";
const LETTER_RE = new RegExp(`[${LETTER}]`);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mais longo primeiro: "Martinho Lutero" tem de vencer "Lutero", e
 * "Maria Madalena" tem de vencer "Maria". */
function byLengthDesc(a: string, b: string): number {
  return b.length - a.length;
}

// "Salmo 23" no singular é como quase todo mundo escreve; a lista canônica só
// tem "Salmos".
const BOOK_ALTERNATION = [...LIVROS_BIBLICOS, "Salmo"].sort(byLengthDesc).map(escapeRe).join("|");

/**
 * Sigla → nome canônico ("1Tm" → "1 Timóteo").
 *
 * Sai de `BOOK_CANON`, que já é a lista oficial usada pelo seletor de passagem
 * do editor. Uma segunda tabela de siglas aqui seria a mesma informação em dois
 * lugares, e o dia em que discordassem produziria um link que abre o livro
 * errado.
 *
 * Fora as que são IGUAIS ao nome do livro ("Jó", "Tito" não, mas "Jó" sim):
 * elas já casam pela alternação de nomes completos, e repetidas aqui só
 * dobrariam o tamanho da regex.
 */
const ABBREV_TO_BOOK = new Map(
  BOOK_CANON.filter((b) => b.abbrev !== b.name).map((b) => [b.abbrev, b.name])
);

/**
 * `<sigla> <capítulo>:<versículo>[-<versículo>]`. O versículo é OBRIGATÓRIO,
 * ver a seção sobre abreviação no cabeçalho.
 *
 * Mais longa primeiro, e isso é o que faz "1Jo 2:1" ser 1 João e não João: sem
 * a ordenação, a alternação casaria o "Jo" a partir do segundo caractere, e a
 * fronteira de palavra deixaria passar porque o "1" antes dele não é letra.
 */
const ABBREV_ALTERNATION = [...ABBREV_TO_BOOK.keys()].sort(byLengthDesc).map(escapeRe).join("|");

/**
 * `<livro> <capítulo>[:<versículo>[-<versículo>]]`.
 *
 * O capítulo é obrigatório, ver a nota sobre a ordem das passadas acima. O
 * intervalo aceita hífen e travessão porque o modelo escreve os dois. O ponto
 * como separador de versículo ("João 3.16") ficou de FORA: ele transformaria
 * "Romanos 8. 15 pessoas…" numa referência, e o texto de resumo escreve com
 * dois-pontos.
 */
const SCRIPTURE_RE = new RegExp(
  `(?:${BOOK_ALTERNATION})\\s+\\d{1,3}(?:\\s*:\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)?(?![${LETTER}0-9])`,
  "g"
);

const ABBREV_SCRIPTURE_RE = new RegExp(
  `(?:${ABBREV_ALTERNATION})\\s+\\d{1,3}\\s*:\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?![${LETTER}0-9])`,
  "g"
);

/** "1Tm 4:12" → "1 Timóteo 4:12". A sigla vira o nome que o lookup entende. */
function expandAbbrev(matched: string): string | null {
  const m = /^(\S+)\s+(.+)$/.exec(matched);
  if (!m) return null;
  const book = ABBREV_TO_BOOK.get(m[1]);
  return book ? `${book} ${normalizeRefTail(m[2])}` : null;
}

/** Tira o espaço solto que o modelo deixa em volta dos dois-pontos e do hífen. */
function normalizeRefTail(tail: string): string {
  return tail.replace(/\s*:\s*/, ":").replace(/\s*[-–]\s*/, "-");
}

type NameHit = { slug: string; category: LexiconCategory };

type CompiledLexicon = {
  re: RegExp;
  byTerm: Map<string, NameHit>;
};

/**
 * A regex de nomes é MONTADA A PARTIR DA LISTA, e montá-la custa, uma
 * alternação de trezentos termos ordenada por comprimento. O render de um
 * resumo chama `annotateText` uma vez por parágrafo, e recompilar a cada
 * parágrafo seria pagar esse preço trinta vezes por tela.
 *
 * A memoização é por IDENTIDADE do array, não por conteúdo: o índice desce do
 * servidor como uma referência estável e atravessa a árvore inteira sem mudar,
 * então um slot só resolve o caso real. Comparar conteúdo custaria mais que o
 * acerto que traria.
 */
let lastEntries: LexiconIndexEntry[] | null = null;
let lastCompiled: CompiledLexicon | null = null;

function compile(entries: LexiconIndexEntry[]): CompiledLexicon | null {
  if (entries === lastEntries) return lastCompiled;

  const byTerm = new Map<string, NameHit>();
  for (const entry of entries) {
    const hit = { slug: entry.slug, category: entry.category };
    // O termo canônico vence um apelido de outra entrada: dois cadastros
    // disputando a mesma palavra é erro do admin, e a preferência previsível é
    // melhor que a ordem de chegada.
    for (const alias of entry.aliases) {
      if (!byTerm.has(alias)) byTerm.set(alias, hit);
    }
    byTerm.set(entry.term, hit);
  }

  const compiled =
    byTerm.size === 0
      ? null
      : {
          byTerm,
          re: new RegExp(
            `(?:${[...byTerm.keys()].sort(byLengthDesc).map(escapeRe).join("|")})(?![${LETTER}])`,
            "g"
          ),
        };

  lastEntries = entries;
  lastCompiled = compiled;
  return compiled;
}

/** Casou de verdade, ou o padrão pegou o fim de uma palavra maior? */
function startsAtWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  return !LETTER_RE.test(text[index - 1]);
}

type Match = { start: number; end: number; segment: AnnotatedSegment };

function scan(
  text: string,
  re: RegExp,
  toSegment: (matched: string) => AnnotatedSegment | null
): Match[] {
  const out: Match[] = [];
  re.lastIndex = 0;
  let m = re.exec(text);
  while (m) {
    const matched = m[0];
    if (startsAtWordBoundary(text, m.index)) {
      const segment = toSegment(matched);
      if (segment) out.push({ start: m.index, end: m.index + matched.length, segment });
    }
    m = re.exec(text);
  }
  return out;
}

/**
 * A referência quando o parágrafo INTEIRO é ela — "Lucas 19:11-27" sozinho numa
 * linha —, e `null` em qualquer outro caso.
 *
 * É o sinal que o Biblo usa para MOSTRAR a passagem dentro da conversa em vez
 * de só apontar para ela (ver `BibloPassage`). Uma referência no meio da frase
 * continua sendo um link, como no resumo e no estudo: o que muda o tratamento
 * é ela estar sozinha, que é como quem conversa destaca um trecho antes de
 * comentá-lo.
 *
 * Mora aqui porque a decisão tem de usar o MESMO reconhecimento do `RichText`.
 * Uma segunda regex faria a tela mostrar o cartão para uma referência que o
 * anotador não linka, ou o contrário, e as duas telas discordariam sobre o que
 * é uma referência.
 *
 * Roda **sem léxico**, e isso não é economia: uma linha que fosse só "Habacuque"
 * não é uma passagem, e o que interessa aqui é ela ser uma referência e mais
 * nada. O servidor a chama (`biblo/answer.ts`), onde não há índice à mão.
 *
 * A pontuação final é ignorada ("Jonas 1:3." conta), porque o modelo termina a
 * linha com ponto metade das vezes e isso não muda o que ele quis dizer.
 */
export function asStandaloneScripture(text: string): string | null {
  const trimmed = text.trim().replace(/[.:;,\s]+$/, "");
  if (!trimmed) return null;
  const segments = annotateText(trimmed);
  if (segments.length !== 1) return null;
  return segments[0].kind === "scripture" ? segments[0].reference : null;
}

export function annotateText(text: string, entries: LexiconIndexEntry[] = []): AnnotatedSegment[] {
  if (!text) return [];

  const byName = scan(text, SCRIPTURE_RE, (matched) => ({
    kind: "scripture",
    text: matched,
    // A referência que vai ao diálogo é normalizada: o parser de
    // `parseVerseReference` e a rota /api/verse esperam "Livro 3:16", sem o
    // espaço solto que o modelo às vezes deixa em volta dos dois-pontos.
    reference: normalizeRefTail(matched),
  }));

  // A passada das SIGLAS não vê o que a dos nomes já consumiu: "1 Timóteo 4:12"
  // contém um "Tm" que, sozinho, não é referência nenhuma.
  const takenByName = (from: number, to: number) =>
    byName.some((s) => from < s.end && to > s.start);

  const byAbbrev = scan(text, ABBREV_SCRIPTURE_RE, (matched) => {
    const reference = expandAbbrev(matched);
    return reference ? { kind: "scripture", text: matched, reference } : null;
  }).filter((m) => !takenByName(m.start, m.end));

  const scripture = [...byName, ...byAbbrev];

  const covered = (from: number, to: number) => scripture.some((s) => from < s.end && to > s.start);

  const lexicon = compile(entries);
  const names = lexicon
    ? scan(text, lexicon.re, (matched) => {
        const hit = lexicon.byTerm.get(matched);
        return hit ? { kind: "name", text: matched, slug: hit.slug, category: hit.category } : null;
      }).filter((m) => !covered(m.start, m.end))
    : [];

  const matches = [...scripture, ...names].sort((a, b) => a.start - b.start);

  const segments: AnnotatedSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    // Duas menções de nome podem se sobrepor quando uma contém a outra e a
    // ordenação por comprimento não resolveu (termos de entradas diferentes). A
    // primeira vence; a segunda é descartada.
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.start) });
    }
    segments.push(match.segment);
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });

  return segments;
}
