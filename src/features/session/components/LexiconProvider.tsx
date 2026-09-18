"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { LexiconIndexEntry } from "@/lib/domain/lexicon";

/**
 * O índice do léxico, descendo do servidor até o `RichText`.
 *
 * ## Por que contexto, e não prop
 *
 * O anotador precisa da lista, e a lista vem do banco. A alternativa era passar
 * um `names` por prop, e o caminho até o `RichText` tem cinco degraus em quatro
 * árvores diferentes — `SummaryView` → `BlockRenderer`, `StudyBlockRenderer`,
 * `BibloMessage`, a tela de leitura do painel. Cinco lugares para passar, e o
 * que acontece quando alguém esquece um é a marcação sumir daquela tela **sem
 * erro nenhum**, que é o pior jeito de uma coisa quebrar neste produto.
 *
 * O preço foi tornar `RichText` um componente CLIENTE (ele era compartilhado, e
 * renderizava no servidor na landing). Na prática o custo é o próprio
 * `RichText` mais o `annotate.ts` no bundle da landing, ~1,5 KB: o diálogo da
 * passagem, que é o peso de verdade, continua entrando por `dynamic` e só no
 * primeiro clique. Ver o cabeçalho de `ChapterMention`.
 *
 * ## Quem monta o provedor
 *
 * O layout de `(app)` — que cobre o resumo, o estudo, o editor e o Biblo — e a
 * tela de leitura do painel. **A landing não monta**, de propósito: ela é a
 * única rota que um anônimo carrega inteira, e pendurar uma consulta ao banco
 * num mockup seria pagar latência na página mais sensível do produto para
 * marcar "Jacó" numa foto de tela falsa. Sem provedor, o padrão é lista vazia e
 * o anotador só reconhece referência bíblica, que é o que ele já fazia lá.
 */
const LexiconContext = createContext<LexiconIndexEntry[]>([]);

export function LexiconProvider({
  entries,
  children,
}: {
  entries: LexiconIndexEntry[];
  children: ReactNode;
}) {
  return <LexiconContext.Provider value={entries}>{children}</LexiconContext.Provider>;
}

/**
 * O índice, ou lista vazia fora do provedor.
 *
 * **Lista vazia não é erro**, é "nada para marcar". O anotador memoriza a regex
 * pela IDENTIDADE do array (ver `annotate.ts`), e é por isso que o valor padrão
 * do contexto é uma constante e não um `[]` novo a cada render: um literal aqui
 * invalidaria o cache a cada parágrafo da landing.
 */
export function useLexiconIndex(): LexiconIndexEntry[] {
  return useContext(LexiconContext);
}
