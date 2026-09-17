import "server-only";
import { parseVerseReference } from "@/lib/domain/reference";
import type { SummaryPayload } from "@/lib/domain/summary";

/**
 * O cumprimento e os primeiros chips. **Sem LLM, e essa é a decisão.**
 *
 * Abrir a gaveta não gasta presente, não gasta moeda, não gasta dólar e não
 * espera nada. Uma abertura gerada custaria uma chamada a cada gaveta aberta,
 * inclusive as que ninguém usa — e ela é a única parte da conversa cujo
 * material está INTEIRO na tela: o título, a ideia central e as passagens
 * citadas bastam para a primeira frase ser específica, que é o que o
 * `biblo.md` §4 pede.
 *
 * Chips com inteligência de verdade são os OUTROS: os que vêm depois de uma
 * resposta, puxados do que acabou de ser dito, e que saem de graça no mesmo
 * JSON que escreveu a resposta.
 */

export type BibloOpening = { greeting: string; chips: string[] };

/** Três a cinco por vez, nunca a lista inteira (`biblo.md` §4). */
const MAX_CHIPS = 5;

/**
 * Os dois que valem para qualquer texto, e que ficam por último de propósito:
 * os derivados do conteúdo são melhores, e estes existem para a fileira nunca
 * ficar curta.
 */
const GENERIC_CHIPS = ["Uma pergunta que incomode", "O que ler sobre isso"];

const EMPTY_CHIPS = [
  "Sobre qual passagem quero escrever?",
  "Me ajuda a achar um tema",
  "O que a Bíblia diz sobre perdão?",
];

/**
 * As referências citadas no texto, em ordem de aparição e sem repetir.
 *
 * Vem dos blocos `bibleQuote` E da prosa: uma passagem mencionada no meio de um
 * parágrafo é tão citada quanto a que virou bloco, e `parseVerseReference` é o
 * mesmo parser que a tela usa para transformá-la em link — um segundo parser
 * aqui faria a gaveta e o texto discordarem sobre o que "Romanos 8" significa.
 */
function citedReferences(summary: SummaryPayload): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const parsed = parseVerseReference(raw);
    if (!parsed) return;
    // O CAPÍTULO, não o versículo: "Contexto de Jonas 1" é a pergunta que a
    // pessoa faria; "Contexto de Jonas 1:1-3" é a mesma pergunta com uma
    // precisão que ninguém pediu — e faz dois chips iguais quando o texto cita
    // dois trechos do mesmo capítulo.
    const display = `${parsed.bookDisplay} ${parsed.chapter}`;
    const key = display.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(display);
  };

  for (const block of summary.blocks) {
    if (block.type === "bibleQuote") push(block.reference);
  }
  return found;
}

export function buildBibloOpening(
  summary: SummaryPayload | null,
  speakerName: string | null
): BibloOpening {
  const title = summary?.title?.trim() ?? "";
  const hasContent = !!summary && (summary.blocks.length > 0 || !!summary.shortSummary.trim());

  // A folha em branco: cumprimenta sem fingir que sabe de algo. É o caso de
  // quem acabou de abrir o `/escrever`, e um "vi que você está escrevendo
  // sobre" ali seria uma mentira na primeira frase.
  if (!hasContent) {
    return {
      greeting: "Oi! Sou o Biblo. Sobre o que você quer escrever?",
      chips: EMPTY_CHIPS,
    };
  }

  const greeting = title
    ? `Vi que você está com "${title}" aqui${speakerName ? `, de ${speakerName}` : ""}. Quer conversar sobre o quê?`
    : "Li o que está na tela. Quer conversar sobre o quê?";

  const chips: string[] = [];
  for (const reference of citedReferences(summary)) {
    if (chips.length >= MAX_CHIPS - GENERIC_CHIPS.length) break;
    chips.push(`Contexto de ${reference}`);
  }
  if (summary.shortSummary.trim()) chips.push("Outras passagens sobre isto");
  chips.push(...GENERIC_CHIPS);

  return { greeting, chips: chips.slice(0, MAX_CHIPS) };
}
