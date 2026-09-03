import "server-only";
import { serverEnv } from "@/lib/env/server";
import { createLogger } from "@/lib/log";

/**
 * Resolve a capa de um livro indicado num bloco `reading`.
 *
 * ⚠️ **A URL nunca vem do modelo.** Um link inventado é indistinguível de um
 * link real até alguém clicar, e o custo de errar aqui é levar o leitor a um
 * 404 ou — pior — à capa de outro livro. Só entra no payload o que uma API
 * externa confirmou pelo par autor+título.
 *
 * ## Por que Google Books, e por que atrás de uma env var
 *
 * Medido contra os 41 livros do índice de teólogos:
 *
 *   - **Open Library**, busca estrita: 2 de 41. Busca livre: acha capa, mas do
 *     livro ERRADO — "Alegria em Deus" (Piper) devolveu a capa de "I e II
 *     Pedro"; "A Cruz de Cristo" (Stott) devolveu "Testemunho da Verdade".
 *     Capa errada ao lado de uma indicação de leitura é pior que capa nenhuma:
 *     manda a pessoa procurar outro livro na livraria.
 *   - **Google Books sem chave**: `429 Quota exceeded` em toda chamada. Os
 *     zeros da primeira medição eram quota, não ausência de acervo.
 *
 * Ou seja: sem chave não há fonte confiável para teologia em português. Por
 * isso a busca é OPCIONAL — sem `GOOGLE_BOOKS_API_KEY` o resolvedor devolve
 * `null` sem chamar ninguém, e a UI desenha a capa tipográfica. Configurar a
 * chave liga as capas reais sem tocar em mais nada.
 */

const log = createLogger("study/covers");

/**
 * Teto de livros consultados por estudo. Um artigo traz dois ou três
 * `reading`; o limite existe para o caso patológico em que o redator enche o
 * texto de indicações e a geração passa a esperar por uma dúzia de chamadas
 * externas dentro de um orçamento de função que já é apertado.
 */
const MAX_LOOKUPS = 6;

/** Curto de propósito: capa é enfeite. Nunca vale atrasar o estudo por ela. */
const TIMEOUT_MS = 4_000;

export type CoverQuery = { author: string; title: string };

/**
 * `null` quando não há chave, quando a API não responde, ou quando o volume
 * encontrado não confere com o que pedimos. Silêncio é a resposta correta —
 * quem chama simplesmente não recebe `coverUrl`.
 */
export async function resolveCover(query: CoverQuery): Promise<string | null> {
  const key = serverEnv.GOOGLE_BOOKS_API_KEY;
  if (!key) return null;

  const q = `intitle:${query.title} inauthor:${query.author}`;
  const url =
    "https://www.googleapis.com/books/v1/volumes" +
    `?q=${encodeURIComponent(q)}&maxResults=3&printType=books&key=${encodeURIComponent(key)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log.warn("busca de capa falhou", { status: res.status, title: query.title });
      return null;
    }
    const body = (await res.json()) as {
      items?: {
        volumeInfo?: {
          title?: string;
          authors?: string[];
          imageLinks?: { thumbnail?: string; smallThumbnail?: string };
        };
      }[];
    };

    for (const item of body.items ?? []) {
      const info = item.volumeInfo;
      const thumb = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
      if (!thumb) continue;
      // Conferência do lado de cá: a query é estrita, mas o Google relaxa
      // sozinho quando não acha nada exato, e é assim que se recebe a capa de
      // outro livro do mesmo autor.
      if (!looksLikeMatch(query, info?.title, info?.authors)) continue;
      // http:// é o que a API devolve, e uma imagem insegura numa página https
      // é simplesmente bloqueada pelo navegador.
      return thumb.replace(/^http:/, "https:");
    }
    return null;
  } catch (err) {
    // Abort entra aqui: capa é enfeite, e nada disso pode derrubar o estudo.
    log.warn("busca de capa abortada", { title: query.title, error: (err as Error).message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve várias capas em paralelo, respeitando o teto. Devolve um mapa
 * `"autor||título" → url` com apenas os que resolveram.
 */
export async function resolveCovers(queries: CoverQuery[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (!serverEnv.GOOGLE_BOOKS_API_KEY || queries.length === 0) return found;

  const unique = new Map<string, CoverQuery>();
  for (const q of queries) {
    const k = coverKey(q.author, q.title);
    if (!unique.has(k)) unique.set(k, q);
  }

  const entries = [...unique.entries()].slice(0, MAX_LOOKUPS);
  const results = await Promise.all(
    entries.map(async ([k, q]) => [k, await resolveCover(q)] as const)
  );
  for (const [k, url] of results) if (url) found.set(k, url);

  log.debug("capas resolvidas", { pedidas: entries.length, achadas: found.size });
  return found;
}

export function coverKey(author: string, title: string): string {
  return `${normalize(author)}||${normalize(title)}`;
}

function normalize(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O volume devolvido é mesmo o que pedimos?
 *
 * Título: exige que um dos dois contenha o outro depois de normalizado — cobre
 * subtítulo ("Confissões" ⊂ "Confissões de Santo Agostinho") sem aceitar outro
 * livro do mesmo autor.
 *
 * Autor: basta o SOBRENOME bater. "C. S. Lewis" e "Clive Staples Lewis" são a
 * mesma pessoa, e as edições brasileiras variam a forma do nome livremente.
 */
function looksLikeMatch(
  query: CoverQuery,
  foundTitle: string | undefined,
  foundAuthors: string[] | undefined
): boolean {
  if (!foundTitle) return false;
  const want = normalize(query.title);
  const got = normalize(foundTitle);
  if (!want || !got) return false;
  if (!got.includes(want) && !want.includes(got)) return false;

  const surname = normalize(query.author).split(" ").filter(Boolean).pop();
  if (!surname) return true;
  return (foundAuthors ?? []).some((a) => normalize(a).includes(surname));
}
