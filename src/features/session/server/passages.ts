import "server-only";

import { type DehydratedState, dehydrate, QueryClient } from "@tanstack/react-query";
import { loadBible } from "@/lib/bibles/loader";
import { lookupPassage } from "@/lib/bibles/lookup";
import { formatPassageRange, parseVerseReference } from "@/lib/domain/reference";
import type { SummaryBlock } from "@/lib/domain/summary";
import type { PassagePayload } from "@/lib/domain/verse";
import { createLogger } from "@/lib/log";

const log = createLogger("passages");

/**
 * O texto das passagens de um resumo, resolvido no SERVIDOR e entregue junto
 * com o HTML.
 *
 * ## Isto existe para consertar uma divergência de hidratação
 *
 * `PassageVerses` busca o texto por `useQuery`. No servidor o cache está vazio,
 * então o HTML sai com o ESQUELETO; no navegador, o cache do TanStack é
 * restaurado do IndexedDB antes de o React hidratar (ver
 * `shared/components/Providers.tsx`), e a primeira renderização do cliente já sai
 * com os VERSÍCULOS. Duas árvores diferentes para o mesmo nó, e o React
 * descartava o HTML do servidor com um aviso no console:
 *
 *     - <span className="... animate-skeleton-shimmer ...">
 *     + <p className="text-sm ...">
 *
 * O conserto ingênuo seria segurar o esqueleto até a hidratação terminar —
 * trocaria um aviso de console por um PISCAR visível em toda passagem de todo
 * resumo, para toda gente. O conserto certo é o servidor saber a resposta, que
 * ele sabe: a NVI está em disco, ao lado dele.
 *
 * ## E de quebra
 *
 * A tela para de chamar `/api/verse` na abertura. Um resumo com seis passagens
 * fazia uma requisição autenticada com a página já desenhada, só para preencher
 * buracos que o servidor podia ter preenchido de graça.
 *
 * ## Quem precisa disto
 *
 * Toda página que renderiza blocos de resumo no servidor: `/summary/:id`,
 * `/summary/:id/edit` e `/admin/sessions/:id`. Uma página que esqueça a chamada não
 * quebra — volta a ter o aviso e a requisição —, e é por isso que a chave da
 * entrada é montada pelo `formatPassageRange` compartilhado, e não por uma
 * string escrita à mão aqui: uma chave que não bate é uma semeadura que ninguém
 * lê, e isso não dá erro nenhum.
 */
export async function dehydratePassages(
  blocks: SummaryBlock[] | undefined
): Promise<DehydratedState | null> {
  if (!blocks?.length) return null;

  // Só a passagem com FAIXA é buscada pelo `PassageVerses`; a referência de
  // capítulo inteiro vira `ChapterMention`, que não busca nada até o clique.
  const wanted = new Map<string, { book: string; chapter: number; start: number; end: number }>();
  for (const block of blocks) {
    if (block.type !== "bibleQuote") continue;
    const parsed = parseVerseReference(block.reference);
    if (!parsed?.startVerse) continue;
    const end = parsed.endVerse ?? parsed.startVerse;
    const reference = formatPassageRange(
      parsed.bookDisplay,
      parsed.chapter,
      parsed.startVerse,
      end
    );
    if (wanted.has(reference)) continue;
    wanted.set(reference, {
      book: parsed.bookDisplay,
      chapter: parsed.chapter,
      start: parsed.startVerse,
      end,
    });
  }
  if (wanted.size === 0) return null;

  const bible = await loadBible();
  if (!bible) {
    // Sem a tradução em disco não há o que semear, e a tela volta ao caminho
    // antigo (busca por `/api/verse`) sozinha. Não é motivo para derrubar um
    // resumo que, afinal, é o destino de tudo que o produto faz.
    log.warn("miss", { reason: "translation-file-missing" });
    return null;
  }

  const client = new QueryClient();
  for (const [reference, ref] of wanted) {
    const verses = lookupPassage(bible, ref.book, ref.chapter, ref.start, ref.end);
    // Referência que não resolve fica de FORA do cache, e não entra como lista
    // vazia: vazio seria um acerto gravado com `staleTime: Infinity`, e a tela
    // nunca mais tentaria. Ausente, o cliente busca e decide como sempre.
    if (verses.length === 0) continue;
    client.setQueryData<PassagePayload>(["passage", reference], {
      reference,
      book: ref.book,
      chapter: ref.chapter,
      verses,
    });
  }

  return dehydrate(client);
}
