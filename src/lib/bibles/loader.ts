import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "@/lib/log";
import {
  DEFAULT_TRANSLATION,
  parseTranslation,
  TRANSLATIONS,
  type TranslationId,
} from "./translations";

const log = createLogger("bibles");

export type BibleBook = { abbrev: string; chapters: string[][] };
export type Bible = BibleBook[];

export { DEFAULT_TRANSLATION, parseTranslation, type TranslationId };

/**
 * A tradução que o app lê quando ninguém escolheu nada. Continua exportada com
 * este nome porque é o que os prompts citam ao dizer ao modelo quem mostra o
 * texto bíblico (ver `server/prompts/biblo.ts`).
 */
export const BIBLE_TRANSLATION = TRANSLATIONS[DEFAULT_TRANSLATION].name;

// `process.cwd()` é a RAIZ do repositório (é de lá que o Next roda), não
// `src/`: por isso o "src" explícito no caminho.
function bibleFile(translation: TranslationId): string {
  return path.join(process.cwd(), "src", "lib", "bibles", `${translation}.json`);
}

/**
 * Cache POR TRADUÇÃO, e é o LRU que o comentário antigo pedia — só que sem
 * LRU nenhum, porque o registro de traduções é fechado (três) e o `Map` não
 * pode crescer além dele. Um LRU de verdade aqui seria política de despejo
 * para um conjunto que não cresce.
 *
 * Cada arquivo custa ~4 MB de JSON e algumas dezenas de MB de heap depois do
 * parse, então o custo real de alguém alternar entre duas traduções é ter as
 * duas residentes — aceitável, e muito mais barato que reparsear 4 MB a cada
 * passagem trocada na tela.
 *
 * `loading` deduplica chamadas concorrentes: sem ele, dois requests que chegam
 * juntos no boot fazem dois `readFile` e dois `JSON.parse` do mesmo arquivo.
 */
const cached = new Map<TranslationId, Bible>();
const loading = new Map<TranslationId, Promise<Bible | null>>();

/**
 * Uma tradução, lida do disco na primeira chamada e mantida em memória.
 *
 * Sem argumento devolve o padrão, que é o que o `instrumentation.ts` aquece no
 * boot e o que toda leitura de servidor usa quando a pessoa não tem
 * preferência. Ver `translations.ts` para quem pode ser escolhida e por quê.
 */
export async function loadBible(
  translation: TranslationId = DEFAULT_TRANSLATION
): Promise<Bible | null> {
  const hit = cached.get(translation);
  if (hit) return hit;

  const pending = loading.get(translation);
  if (pending) return pending;

  const task = (async (): Promise<Bible | null> => {
    const file = bibleFile(translation);
    try {
      const raw = await fs.readFile(file, "utf-8");
      const data = JSON.parse(raw) as Bible;
      cached.set(translation, data);
      return data;
    } catch (err) {
      // Antes este catch era mudo, e uma falha de empacotamento (o JSON não
      // subir junto com a função) viraria "versículo não encontrado" em vez
      // de erro, silêncio no lugar exato onde se procuraria a causa.
      log.error("falha ao carregar a Bíblia", {
        translation,
        path: file,
        error: (err as Error).message,
      });
      return null;
    } finally {
      loading.delete(translation);
    }
  })();

  loading.set(translation, task);
  return task;
}
