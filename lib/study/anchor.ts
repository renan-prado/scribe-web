import "server-only";
import { abbrevFor } from "@/lib/bibles/books";
import { CHAPTER_VERSE_COUNTS } from "@/lib/bibles/chapter-lengths";
import { loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/feed";

/**
 * PASSO 3 — a ANCORAGEM. Sem LLM.
 *
 * Toda referência bíblica que o respondedor citou é resolvida contra a NVI
 * local.
 * A que existe volta com o TEXTO REAL; a que não existe é descartada antes de
 * chegar ao redator.
 *
 * É a metade determinística do pipeline, e a razão de ela existir é simples:
 * o prompt anterior gastava uma seção inteira ("BIBLEQUOTE — REGRA DE OURO")
 * pedindo ao modelo que não parafraseasse a Escritura, num repositório que já
 * tem `lookupVerse` e a NVI em disco, usados por `/api/verse` e pelos
 * `rereads`. Nenhuma instrução em linguagem natural, por mais maiúscula,
 * alcança o que uma consulta a um JSON alcança de graça.
 *
 * Regra geral que este módulo materializa: **toda restrição que pode virar
 * código sai do prompt e vira código.**
 */

export type AnchoredPassage = {
  /** A referência normalizada, como será exibida. */
  reference: string;
  /** Texto real da NVI. Nunca vazio — sem texto a passagem não é ancorada. */
  text: string;
};

/**
 * Resolve uma referência solta ("Marcos 4:35-41", "Salmos 23") para o texto
 * real. `null` quando o livro, o capítulo ou o verso não existem.
 *
 * Referência sem verso ("Salmos 23") resolve o capítulo INTEIRO — é o que a
 * pessoa quis dizer, e `CHAPTER_VERSE_COUNTS` já sabe onde ele termina.
 */
export async function anchorReference(raw: string): Promise<AnchoredPassage | null> {
  const parsed = parseVerseReference(raw);
  if (!parsed) return null;

  const abbrev = abbrevFor(parsed.bookDisplay);
  if (!abbrev) return null;

  const counts = CHAPTER_VERSE_COUNTS[abbrev];
  const chapterLength = counts?.[parsed.chapter - 1];
  if (!chapterLength) return null;

  const start = parsed.startVerse ?? 1;
  const end = parsed.endVerse ?? parsed.startVerse ?? chapterLength;
  if (start < 1 || start > chapterLength) return null;
  const clampedEnd = Math.min(end, chapterLength);

  const bible = await loadBible();
  if (!bible) return null;

  const { text } = lookupVerse(bible, parsed.bookDisplay, parsed.chapter, start, clampedEnd);
  if (!text.trim()) return null;

  const reference =
    parsed.startVerse == null
      ? `${parsed.bookDisplay} ${parsed.chapter}`
      : clampedEnd > start
        ? `${parsed.bookDisplay} ${parsed.chapter}:${start}-${clampedEnd}`
        : `${parsed.bookDisplay} ${parsed.chapter}:${start}`;

  return { reference, text: text.trim() };
}

/**
 * Limite de passagens ancoradas por estudo. Doze respostas podem citar trinta
 * referências; mandar o capítulo inteiro de cada uma para o redator infla o
 * prompt sem melhorar o texto. O corte segue a ordem das respostas, que já é
 * ordem de prioridade — a primeira resposta é a mais importante.
 */
const MAX_ANCHORED = 18;

/**
 * Ancora uma lista de referências, deduplicando pela forma normalizada.
 *
 * Devolve também `dropped`, as que não resolveram. Elas vão para o log: uma
 * taxa alta de descarte é sinal de que o respondedor está inventando
 * referência, e é o tipo de coisa que não se descobre sem medir.
 */
export async function anchorReferences(refs: string[]): Promise<{
  anchored: AnchoredPassage[];
  dropped: string[];
}> {
  const anchored: AnchoredPassage[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const raw of refs) {
    if (anchored.length >= MAX_ANCHORED) break;
    const resolved = await anchorReference(raw);
    if (!resolved) {
      dropped.push(raw);
      continue;
    }
    const key = resolved.reference.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    anchored.push(resolved);
  }

  return { anchored, dropped };
}

/** Bloco que entra no prompt do redator. */
export function renderAnchoredPassages(list: AnchoredPassage[]): string {
  if (list.length === 0) return "(nenhuma passagem conferida)";
  return list.map((p) => `${p.reference} — ${p.text}`).join("\n\n");
}
