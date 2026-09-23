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

/* -------------------------------------------------------------------------
 * O TEXTO CRU E O TEXTO VISÍVEL
 *
 * Na EDIÇÃO as cercas não aparecem. Elas são a gramática que guarda a marca
 * dentro da string, e quem está escrevendo um sermão não tem nada que ver com
 * ela: `==texto==` no meio da frase é ruído que a pessoa não pediu, não pode
 * apagar sem perder a marca, e ainda cobra duas setas para atravessar um
 * "caractere" que não existe na tela.
 *
 * Uma `textarea` não sabe esconder parte do próprio conteúdo, então o editor
 * mostra o texto VISÍVEL (`stripMarks`) e devolve cada edição para o texto CRU
 * por aqui. **O schema não muda**: o que está guardado continua sendo
 * `{ type, text }` com as cercas dentro, e a leitura continua lendo a mesma
 * string. O que passou a existir é uma tradução de MÃO DUPLA, viva só enquanto
 * a caixa está na tela.
 *
 * As três funções abaixo são essa tradução, e a regra que as une é uma só:
 * **na BORDA de uma marca, o cursor está do lado de fora dela.** Quem digita
 * colado no começo ou no fim de um trecho marcado está escrevendo texto novo,
 * não estendendo a marca de alguém; no MEIO, sim, o que se digita entra na
 * marca, que é o que "escrever dentro do grifo" quer dizer.
 * ------------------------------------------------------------------------- */

/** O que cabe DENTRO de uma marca sem quebrá-la. Ver `MARK_RE`. */
function fitsInsideMark(text: string): boolean {
  return !text.includes("=") && !text.includes("\n");
}

/** Uma marca em volta do texto, ou nada quando não sobrou texto para marcar. */
function fenced(text: string): string {
  return text ? `${MARK_FENCE}${text}${MARK_FENCE}` : "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Uma posição do texto visível, no texto cru. */
export function displayToRaw(raw: string, index: number): number {
  let display = 0;
  for (const segment of splitMarks(raw)) {
    const end = display + segment.text.length;
    if (index < end) {
      if (!segment.marked) return segment.start + (index - display);
      // A borda de abertura é o lado de fora: antes da cerca.
      if (index === display) return segment.start;
      return segment.start + MARK_FENCE.length + (index - display);
    }
    display = end;
  }
  return raw.length;
}

/** O caminho de volta: uma posição do texto cru, no texto visível. */
export function rawToDisplay(raw: string, index: number): number {
  let display = 0;
  for (const segment of splitMarks(raw)) {
    if (index < segment.end) {
      if (!segment.marked) return display + Math.max(0, index - segment.start);
      return display + clamp(index - segment.start - MARK_FENCE.length, 0, segment.text.length);
    }
    display += segment.text.length;
  }
  return display;
}

/**
 * O texto cru depois de uma edição feita sobre o texto VISÍVEL.
 *
 * A edição é descoberta por diferença — o pedaço comum no começo, o pedaço
 * comum no fim, e o que sobrou no meio —, e não pelo evento do teclado: colar,
 * apagar uma seleção, o autocompletar do celular e o Ctrl+Z chegam todos como
 * "o campo agora contém isto", e a mesma conta serve para os quatro.
 *
 * Três decisões moram aqui:
 *
 * - **apagar o conteúdo inteiro de uma marca apaga a marca**, cercas incluídas.
 *   Deixá-las daria `====` à vista no meio da frase, que é a sintaxe vazando
 *   exatamente onde ela não devia aparecer.
 * - **um `=` digitado dentro de uma marca a DESFAZ.** A regex não aceita `=`
 *   dentro (ver `MARK_RE`), então a alternativa seria comer o caractere que a
 *   pessoa acabou de digitar.
 * - **uma quebra de linha dentro de uma marca a PARTE em duas**, que é a mesma
 *   regra de a marca não atravessar linha. Só acontece nas listas, o único
 *   bloco cujo Enter escreve um `\n` em vez de abrir um bloco novo.
 *
 * E há uma REDE embaixo de tudo: se a reconstrução não devolver exatamente o
 * texto visível que chegou, o que vale é o texto visível, sem marca nenhuma.
 * Perder o amarelo de um parágrafo é reparável com um clique; perder ou
 * duplicar um caractere debaixo do cursor de quem está escrevendo, não.
 */
export function applyDisplayEdit(raw: string, nextDisplay: string): string {
  const before = stripMarks(raw);
  if (before === nextDisplay) return raw;

  const shortest = Math.min(before.length, nextDisplay.length);
  let head = 0;
  while (head < shortest && before[head] === nextDisplay[head]) head += 1;
  let tail = 0;
  while (
    tail < shortest - head &&
    before[before.length - 1 - tail] === nextDisplay[nextDisplay.length - 1 - tail]
  ) {
    tail += 1;
  }
  const from = head;
  const to = before.length - tail;
  const inserted = nextDisplay.slice(head, nextDisplay.length - tail);

  let out = "";
  let display = 0;
  let placed = false;
  for (const segment of splitMarks(raw)) {
    const start = display;
    const end = start + segment.text.length;
    display = end;

    const kept =
      segment.text.slice(0, clamp(from - start, 0, segment.text.length)) +
      segment.text.slice(clamp(to - start, 0, segment.text.length));

    // No MEIO deste trecho: o que se digita entra nele.
    if (!placed && from > start && from < end) {
      const left = segment.text.slice(0, clamp(from - start, 0, segment.text.length));
      const right = segment.text.slice(clamp(to - start, 0, segment.text.length));
      placed = true;
      if (!segment.marked || fitsInsideMark(inserted)) {
        out += segment.marked ? fenced(left + inserted + right) : left + inserted + right;
      } else if (inserted.includes("=")) {
        out += left + inserted + right;
      } else {
        out += fenced(left) + inserted + fenced(right);
      }
      continue;
    }

    // Na BORDA: o que se digita fica de fora da marca, antes deste trecho.
    if (!placed && from <= start) {
      out += inserted;
      placed = true;
    }
    out += segment.marked ? fenced(kept) : kept;
  }
  if (!placed) out += inserted;

  return stripMarks(out) === nextDisplay ? out : nextDisplay;
}

/**
 * O `toggleMark` para quem só tem as posições do texto VISÍVEL: traduz o
 * recorte para o texto cru, liga ou desliga a marca lá, e devolve onde a
 * seleção ficou — de novo em posições visíveis, que é o que a `textarea`
 * entende.
 */
export function toggleMarkOnDisplay(raw: string, start: number, end: number): MarkToggle | null {
  const toggled = toggleMark(raw, displayToRaw(raw, start), displayToRaw(raw, end));
  if (!toggled) return null;
  return {
    text: toggled.text,
    start: rawToDisplay(toggled.text, toggled.start),
    end: rawToDisplay(toggled.text, toggled.end),
  };
}
