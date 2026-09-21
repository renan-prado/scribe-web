/**
 * PARÁGRAFOS: transformar uma parede de texto em algo que se lê.
 *
 * ## Por que isto existe
 *
 * Duas superfícies do produto mostram prosa que não foi diagramada por ninguém
 * — a resposta do Biblo, escrita por um modelo, e o cartão do léxico, escrito à
 * mão num `<textarea>` do painel. Nos dois casos o pior resultado é o mesmo:
 * uma tela inteira de cinza sem um ponto de apoio, que é OLHADA e não lida.
 *
 * Este módulo era uma função privada dentro de `biblo/answer.ts`, que leva
 * `import "server-only"`. Ele saiu de lá quando o segundo consumidor apareceu:
 * copiar `splitWall` para o cartão do léxico daria dois limiares para a mesma
 * pergunta, e eles divergiriam no primeiro ajuste — uma tela quebrando aos 600
 * caracteres e a outra aos 800, sem nada que explicasse a diferença.
 *
 * É client-safe de propósito: quem desenha o cartão do léxico é um componente
 * do navegador.
 */

/**
 * O parágrafo que já é uma PAREDE, e o tamanho para o qual ele é quebrado.
 *
 * O limiar é ALTO de propósito. Quebrar prosa numa fronteira de frase que o
 * autor não escolheu é sempre um pouco errado, então só vale a pena quando o
 * certo já está perdido: até 600 caracteres o parágrafo passa intocado, e o que
 * passa disso é dividido em pedaços de ~380, que é a ordem de grandeza de três
 * frases em português.
 */
const PARAGRAPH_WALL_CHARS = 600;
const PARAGRAPH_TARGET_CHARS = 380;

/** Uma frase: tudo até o ponto final (ou `?`/`!`) e o espaço que o segue. */
const SENTENCE_RE = /[^.!?]+(?:[.!?]+|$)\s*/g;

export function splitWall(paragraph: string): string[] {
  if (paragraph.length <= PARAGRAPH_WALL_CHARS) return [paragraph];

  const sentences = paragraph.match(SENTENCE_RE);
  // Parede sem ponto final nenhum: não há onde cortar sem cortar uma frase ao
  // meio, e um corte assim é pior que a parede.
  if (!sentences || sentences.length < 2) return [paragraph];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence;
    if (current.length >= PARAGRAPH_TARGET_CHARS) {
      chunks.push(current.trim());
      current = "";
    }
  }
  // O resto vai junto com o último pedaço quando é curto demais para ser um
  // parágrafo por si: uma linha de seis palavras sozinha no fim lê como erro.
  if (current.trim()) {
    if (current.trim().length < 120 && chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${current.trim()}`;
    } else {
      chunks.push(current.trim());
    }
  }
  return chunks;
}

/**
 * O texto com respiro: toda parede vira parágrafos.
 *
 * **Uma quebra de linha SOZINHA já separa parágrafos aqui**, e isso não é
 * tolerância, é o que o campo de origem produz: num `<textarea>` não existe
 * quebra automática gravada, então todo `\n` foi digitado por alguém querendo
 * separar duas ideias. Quem exige linha em branco obriga a pessoa a apertar
 * Enter duas vezes para que o parágrafo apareça — e quem aperta uma vez vê o
 * texto todo grudado, sem nada na tela explicando por quê.
 */
export function breathe(text: string): string {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitWall)
    .join("\n\n");
}

/** Os parágrafos já separados, para quem desenha um `<p>` por item. */
export function toParagraphs(text: string): string[] {
  const breathed = breathe(text);
  return breathed ? breathed.split("\n\n") : [];
}
