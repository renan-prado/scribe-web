import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "@/lib/log";

const log = createLogger("bibles");

export type BibleBook = { abbrev: string; chapters: string[][] };
export type Bible = BibleBook[];

/**
 * A aplicação inteira lê UMA tradução. A constante existe para que o número
 * apareça no log e no texto de tela vindo de um lugar só — não para sugerir
 * que trocá-la basta: o arquivo da tradução tem de estar em `lib/bibles/`, e
 * hoje só a NVI está.
 *
 * As outras dez traduções foram removidas: eram 41 MB no bundle de deploy que
 * nenhum caminho de código lia. Se um seletor de tradução voltar a existir,
 * o cache aqui embaixo precisa virar um LRU antes — ver o comentário dele.
 */
export const BIBLE_TRANSLATION = "NVI";

const BIBLE_PATH = path.join(process.cwd(), "lib", "bibles", `${BIBLE_TRANSLATION}.json`);

/**
 * Cache de instância. É uma tradução só (~4 MB de JSON, algumas dezenas de MB
 * de heap depois do parse), então uma referência viva pelo tempo do processo
 * é aceitável e evita reparsear a cada chamada.
 *
 * `loading` deduplica chamadas concorrentes: sem ele, dois requests que
 * chegam juntos no boot fazem dois `readFile` e dois `JSON.parse` do mesmo
 * arquivo de 4 MB.
 */
let cached: Bible | null = null;
let loading: Promise<Bible | null> | null = null;

/** A Bíblia NVI, lida do disco na primeira chamada e mantida em memória. */
export async function loadBible(): Promise<Bible | null> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async (): Promise<Bible | null> => {
    try {
      const raw = await fs.readFile(BIBLE_PATH, "utf-8");
      const data = JSON.parse(raw) as Bible;
      cached = data;
      return data;
    } catch (err) {
      // Antes este catch era mudo, e uma falha de empacotamento (o JSON não
      // subir junto com a função) viraria "versículo não encontrado" em vez
      // de erro — silêncio no lugar exato onde se procuraria a causa.
      log.error("falha ao carregar a Bíblia", {
        translation: BIBLE_TRANSLATION,
        path: BIBLE_PATH,
        error: (err as Error).message,
      });
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}
