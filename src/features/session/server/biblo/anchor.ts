import "server-only";
import { abbrevFor } from "@/lib/bibles/books";
import { CHAPTER_VERSE_COUNTS } from "@/lib/bibles/chapter-lengths";
import { loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/reference";

/**
 * A ANCORAGEM de uma referência bíblica. Sem LLM.
 *
 * Toda referência que o Biblo cita é resolvida contra a NVI local: a que
 * existe volta com o TEXTO REAL, a que não existe é descartada antes de virar
 * bloco na tela. É o que impede o modelo de PARAFRASEAR a Escritura.
 *
 * A razão de ser código e não prompt: o prompt gastava uma seção inteira
 * ("BIBLEQUOTE, REGRA DE OURO") pedindo ao modelo que não inventasse texto
 * bíblico, num repositório que já tem `lookupVerse` e a NVI em disco, usados
 * por `/api/verse` e pelas releituras. Nenhuma instrução em linguagem natural,
 * por mais maiúscula, alcança o que uma consulta a um JSON alcança de graça.
 *
 * Regra geral que este módulo materializa: **toda restrição que pode virar
 * código sai do prompt e vira código.**
 *
 * Morava em `server/study/`, e veio para cá quando o estudo saiu do produto:
 * o Biblo é o único que ancora referência hoje. As duas funções que só o
 * estudo usava (ancorar uma LISTA e renderizá-la para o prompt do redator)
 * saíram junto.
 */

export type AnchoredPassage = {
  /** A referência normalizada, como será exibida. */
  reference: string;
  /** Texto real da NVI. Nunca vazio, sem texto a passagem não é ancorada. */
  text: string;
};

/**
 * Resolve uma referência solta ("Marcos 4:35-41", "Salmos 23") para o texto
 * real. `null` quando o livro, o capítulo ou o verso não existem.
 *
 * Referência sem verso ("Salmos 23") resolve o capítulo INTEIRO, é o que a
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
