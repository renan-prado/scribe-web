import "server-only";

import { type DehydratedState, dehydrate, QueryClient } from "@tanstack/react-query";
import { loadBible } from "@/lib/bibles/loader";
import { lookupPassage } from "@/lib/bibles/lookup";
import { DEFAULT_TRANSLATION, type TranslationId } from "@/lib/bibles/translations";
import { getCurrentAccount } from "@/lib/db/account";
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
 * ele sabe: as traduções estão em disco, ao lado dele.
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
  blocks: SummaryBlock[] | undefined,
  /**
   * A tradução de quem está abrindo a página. A semeadura tem de usar a MESMA
   * que a tela vai pedir — a chave do cache carrega a tradução —, senão ela
   * vira uma entrada que ninguém lê e a divergência de hidratação que este
   * arquivo existe para consertar volta inteira.
   *
   * Omitido, sai do PERFIL de quem está lendo, e é assim que as três páginas o
   * chamam. A leitura é a mesma linha memoizada de `getCurrentAccount` que o
   * layout já buscou neste render, então não custa consulta; e é deliberado
   * que o padrão seja esse, e não a constante do produto: o argumento existe
   * para quem um dia precisar semear por OUTRA pessoa, não para ser o caminho
   * comum — uma página que esquecesse de passá-lo semearia a tradução errada
   * em silêncio, que é exatamente o modo de falhar descrito acima.
   */
  defaultTranslation?: TranslationId
): Promise<DehydratedState | null> {
  if (!blocks?.length) return null;

  const readerTranslation =
    defaultTranslation ??
    (await getCurrentAccount().catch(() => null))?.profile.bibleTranslation ??
    DEFAULT_TRANSLATION;

  // Só a passagem com FAIXA é buscada pelo `PassageVerses`; a referência de
  // capítulo inteiro vira `ChapterMention`, que não busca nada até o clique.
  // A chave é `tradução|referência`: dois blocos com a mesma passagem em
  // traduções diferentes são duas buscas, e a citação com tradução própria não
  // pode ser deduplicada contra a que segue a preferência de quem lê.
  const wanted = new Map<
    string,
    {
      book: string;
      chapter: number;
      start: number;
      end: number;
      reference: string;
      translation: TranslationId;
    }
  >();
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
    const translation = block.translation ?? readerTranslation;
    const key = `${translation}|${reference}`;
    if (wanted.has(key)) continue;
    wanted.set(key, {
      book: parsed.bookDisplay,
      chapter: parsed.chapter,
      start: parsed.startVerse,
      end,
      reference,
      translation,
    });
  }
  if (wanted.size === 0) return null;

  // Uma leitura de disco por TRADUÇÃO presente na página, e não uma por
  // passagem: o cache do loader devolve a mesma referência em memória, mas
  // pedir o arquivo dentro do laço esconderia isso de quem lê o código.
  const bibles = new Map<TranslationId, Awaited<ReturnType<typeof loadBible>>>();
  for (const { translation } of wanted.values()) {
    if (!bibles.has(translation)) bibles.set(translation, await loadBible(translation));
  }

  if (![...bibles.values()].some(Boolean)) {
    // Sem nenhuma tradução em disco não há o que semear, e a tela volta ao
    // caminho antigo (busca por `/api/verse`) sozinha. Não é motivo para
    // derrubar um resumo que, afinal, é o destino de tudo que o produto faz.
    // Uma que falte entre várias apenas não é semeada, logo abaixo.
    log.warn("miss", {
      reason: "translation-file-missing",
      translations: [...bibles.keys()].join(","),
    });
    return null;
  }

  const client = new QueryClient();
  for (const ref of wanted.values()) {
    const source = bibles.get(ref.translation);
    if (!source) continue;
    const verses = lookupPassage(source, ref.book, ref.chapter, ref.start, ref.end);
    // Referência que não resolve fica de FORA do cache, e não entra como lista
    // vazia: vazio seria um acerto gravado com `staleTime: Infinity`, e a tela
    // nunca mais tentaria. Ausente, o cliente busca e decide como sempre.
    if (verses.length === 0) continue;
    client.setQueryData<PassagePayload>(["passage", ref.translation, ref.reference], {
      reference: ref.reference,
      book: ref.book,
      chapter: ref.chapter,
      translation: ref.translation,
      verses,
    });
  }

  return dehydrate(client);
}
