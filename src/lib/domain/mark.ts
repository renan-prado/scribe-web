/**
 * O MARCA-TEXTO: um trecho destacado dentro de um parágrafo.
 *
 * ## Por que ele é sintaxe no texto, e não formatação no schema
 *
 * Porque este produto tem uma invariante que vale a pena manter: **nenhum bloco
 * do `SummaryBlockSchema` tem formatação inline, todos são `{ type, text }`,
 * string pura.** É ela que permite o editor não ter uma biblioteca de rich text
 * (cada bloco é uma `textarea` vestida), que permite a busca varrer o resumo
 * com um `ilike`, e que permite o Biblo montar um bloco do zero sem aprender um
 * formato de documento.
 *
 * Um marca-texto em nós e marcas quebraria as três de uma vez, e traria a
 * pergunta que todo editor de rich text acaba tendo de responder: o que
 * acontece com a marca quando o texto embaixo dela é reescrito. Aqui a marca
 * mora DENTRO da string, em `==assim==`, e a resposta é que não há nada a
 * sincronizar: o texto é a única representação que existe.
 *
 * `==` é a grafia que o Markdown de marca-texto consagrou (Obsidian, Notion,
 * o `mark` do CommonMark estendido), então quem já a conhece acerta de
 * primeira e quem não conhece aprende vendo o botão fazer.
 *
 * ## O que ela NÃO faz
 *
 * Não atravessa linha, e não aninha. Uma marca que cruzasse o `\n` de um
 * parágrafo duplo pintaria a quebra; aninhar duas marcas não tem significado
 * nenhum na tela, já que a segunda pinta a mesma cor da primeira. As duas
 * recusas estão na regex, que é a única definição da sintaxe no produto
 * inteiro — a leitura (`RichText`) e o editor (`Composer`) leem daqui.
 */

/** O que abre e fecha a marca. */
export const MARK_FENCE = "==";

/**
 * Um pedaço de texto, marcado ou não.
 *
 * `start`/`end` são posições no texto CRU, com as cercas incluídas quando
 * `marked`. É isso que permite ao editor apagar as cercas de volta sabendo
 * exatamente onde elas estão.
 */
export type MarkSegment = {
  text: string;
  marked: boolean;
  start: number;
  end: number;
};

/**
 * Sem `=` dentro e sem quebra de linha, e não-guloso.
 *
 * O `[^=\n]` é o que impede `==a== e ==b==` de virar UMA marca de ponta a
 * ponta, e o `\n` de fora é o que impede a marca de atravessar o parágrafo (ver
 * o cabeçalho). `+` e não `*`: `====` não é uma marca vazia, é quatro sinais de
 * igual que alguém digitou.
 */
const MARK_RE = /==([^=\n]+)==/g;

export function hasMark(text: string): boolean {
  MARK_RE.lastIndex = 0;
  return MARK_RE.test(text);
}

/** O texto repartido em trechos marcados e não marcados, na ordem. */
export function splitMarks(text: string): MarkSegment[] {
  const out: MarkSegment[] = [];
  let cursor = 0;
  MARK_RE.lastIndex = 0;
  let match = MARK_RE.exec(text);
  while (match) {
    if (match.index > cursor) {
      out.push({
        text: text.slice(cursor, match.index),
        marked: false,
        start: cursor,
        end: match.index,
      });
    }
    out.push({
      text: match[1],
      marked: true,
      start: match.index,
      end: match.index + match[0].length,
    });
    cursor = match.index + match[0].length;
    match = MARK_RE.exec(text);
  }
  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), marked: false, start: cursor, end: text.length });
  }
  return out;
}

/** O texto sem as cercas. Para quem precisa do conteúdo limpo (busca, resumo curto). */
export function stripMarks(text: string): string {
  return splitMarks(text)
    .map((s) => s.text)
    .join("");
}

export type MarkToggle = { text: string; start: number; end: number };

/**
 * Liga ou desliga a marca sobre uma seleção, e devolve onde a seleção fica
 * depois. `null` quer dizer "não havia o que marcar".
 *
 * **É um TOGGLE de verdade, e a regra é: se a seleção encosta em qualquer
 * trecho já marcado, a ação é DESMARCAR.** É o que a pessoa espera ao apertar o
 * mesmo botão duas vezes, e também o que resolve o caso confuso de uma seleção
 * que cobre metade marcada e metade não: marcar o resto produziria duas marcas
 * grudadas indistinguíveis de uma, enquanto desmarcar tudo é um resultado que
 * se vê e se desfaz.
 *
 * A seleção é APARADA antes de virar marca: arrastar o dedo sobre uma palavra
 * quase sempre leva o espaço seguinte junto, e uma marca que termina num espaço
 * pinta um retângulo amarelo pendurado depois da palavra.
 */
export function toggleMark(text: string, start: number, end: number): MarkToggle | null {
  if (end <= start) return null;
  const segments = splitMarks(text);
  const touched = segments.filter((s) => s.marked && s.start < end && s.end > start);

  if (touched.length > 0) {
    let out = "";
    for (const segment of segments) {
      out += touched.includes(segment) ? segment.text : text.slice(segment.start, segment.end);
    }
    // Cada marca desfeita antes do fim da seleção encurta o texto em quatro
    // caracteres (as duas cercas). Sem esta conta o cursor salta para o meio da
    // palavra seguinte, e a próxima digitação cai no lugar errado.
    const before = touched.filter((s) => s.end <= start).length;
    const inside = touched.filter((s) => s.start >= start && s.end <= end).length;
    const shift = before * MARK_FENCE.length * 2;
    return {
      text: out,
      start: Math.max(0, start - shift),
      end: Math.max(0, end - shift - inside * MARK_FENCE.length * 2),
    };
  }

  const raw = text.slice(start, end);
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  const inner = raw.slice(lead, raw.length - trail);
  // Espaço em branco, ou um `=` que faria a marca nascer quebrada (a regex não
  // aceita `=` dentro, então `==a=b==` não casaria e as cercas ficariam à
  // vista como texto).
  if (!inner.trim() || inner.includes("=") || inner.includes("\n")) return null;

  const at = start + lead;
  const out = `${text.slice(0, at)}${MARK_FENCE}${inner}${MARK_FENCE}${text.slice(at + inner.length)}`;
  return { text: out, start: at, end: at + inner.length + MARK_FENCE.length * 2 };
}
