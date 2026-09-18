"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { requestLexiconIndex } from "@/features/session/lib/api";
import { LEXICON_INDEX_STALE_MS, type LexiconIndexEntry } from "@/lib/domain/lexicon";

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
 * ## O índice do servidor é a PRIMEIRA PINTURA, não a verdade permanente
 *
 * Ele desce dentro do HTML, então a marcação já está lá no primeiro quadro, sem
 * nenhuma requisição. O que ele NÃO é, e por um tempo foi, é o valor definitivo
 * da sessão inteira: este provedor mora num LAYOUT, e o App Router reusa o
 * payload de um layout em toda navegação entre telas que o compartilham — o
 * layout não é re-renderizado, então a lista ficava congelada até um recarregar
 * de página.
 *
 * O sintoma, em produção e em duas linhas: publicar um nome no painel, voltar
 * ao editor, tocar em "Ver como ficou" e não ver marcação nenhuma. Um F5
 * resolvia, e é exatamente essa a assinatura de conteúdo preso num layout.
 * Pior: isso tornava FALSA a promessa escrita no cache do servidor, de que um
 * minuto é o atraso máximo entre publicar e acender.
 *
 * Então o valor do servidor entra como `initialData`, e a cada NAVEGAÇÃO o
 * provedor pergunta se ele passou do prazo. Se passou, revalida em segundo
 * plano; se não, não há requisição nenhuma. Os dois lados usam o MESMO
 * `LEXICON_INDEX_STALE_MS`, senão o maior manda e o outro vira decoração.
 *
 * **A navegação é o gatilho porque é quando o índice IMPORTA.** Não há
 * `refetchOnWindowFocus` (o app inteiro o desliga) nem intervalo: um catálogo
 * que muda uma vez por semana não merece um relógio, e ninguém repara numa
 * marcação que não apareceu numa tela que já estava aberta.
 *
 * ## Quem monta o provedor
 *
 * O layout de `(app)` — que cobre o resumo, o estudo, o editor e o Biblo — e a
 * tela de leitura do painel. **A landing não monta**, de propósito: ela é a
 * única rota que um anônimo carrega inteira, e pendurar uma consulta ao banco
 * num mockup seria pagar latência na página mais sensível do produto para
 * marcar "Jacó" numa foto de tela falsa. Sem provedor, o padrão é lista vazia,
 * o anotador só reconhece referência bíblica, e nenhuma requisição acontece.
 */
const LexiconContext = createContext<LexiconIndexEntry[]>([]);

/**
 * Onde uma menção ABRE, quando não é num diálogo novo.
 *
 * `null` (o padrão) é o caso normal: a menção monta o próprio cartão por cima
 * do texto. Dentro de um cartão que já está aberto, ele é preenchido, e aí a
 * menção NAVEGA no lugar — o mesmo diálogo troca de conteúdo e ganha um voltar.
 *
 * É contexto, e não uma prop do `RichText`, porque quem precisa da informação é
 * o `LexiconMention`, três níveis abaixo, e o `RichText` não deveria saber que
 * esse modo existe para poder repassá-lo.
 *
 * `self` é a entrada que está sendo LIDA, e serve para uma coisa só: não
 * marcar o próprio nome. Um cartão do Timóteo que sublinha "Timóteo" oferece um
 * caminho de volta para onde a pessoa já está.
 */
export type LexiconNav = {
  self: string;
  go: (slug: string) => void;
};

const LexiconNavContext = createContext<LexiconNav | null>(null);

export function LexiconNavProvider({ nav, children }: { nav: LexiconNav; children: ReactNode }) {
  return <LexiconNavContext.Provider value={nav}>{children}</LexiconNavContext.Provider>;
}

export function useLexiconNav(): LexiconNav | null {
  return useContext(LexiconNavContext);
}

export function LexiconProvider({
  entries,
  children,
}: {
  entries: LexiconIndexEntry[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["lexicon-index"] as const,
    queryFn: requestLexiconIndex,
    initialData: entries,
    staleTime: LEXICON_INDEX_STALE_MS,
    // FORA do disco. O índice já vem dentro do HTML de toda tela, então
    // persisti-lo não economiza espera nenhuma — e, ao restaurar, o valor
    // guardado venceria o que o servidor acabou de mandar, fazendo um F5
    // devolver a lista de ontem. Ver `shouldPersist` em `Providers`.
    meta: { persist: false },
  });

  // `pathname` é a DEPENDÊNCIA, não o alvo da leitura: o efeito não usa o valor
  // dele, usa a troca dele como gatilho. É o mesmo caso do `AdminMenu`, que
  // fecha o painel na troca de rota.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a navegação é o gatilho, e ela só existe nesta lista
  useEffect(() => {
    if (Date.now() - dataUpdatedAt >= LEXICON_INDEX_STALE_MS) void refetch();
  }, [pathname, dataUpdatedAt, refetch]);

  return <LexiconContext.Provider value={data}>{children}</LexiconContext.Provider>;
}

/**
 * O índice, ou lista vazia fora do provedor.
 *
 * **Lista vazia não é erro**, é "nada para marcar". O anotador memoriza a regex
 * pela IDENTIDADE do array (ver `annotate.ts`), e é por isso que o valor padrão
 * do contexto é uma constante e não um `[]` novo a cada render: um literal aqui
 * invalidaria o cache a cada parágrafo da landing. Pela mesma razão o valor
 * servido é o `data` do React Query, que só troca de referência quando a lista
 * de fato muda.
 */
export function useLexiconIndex(): LexiconIndexEntry[] {
  return useContext(LexiconContext);
}
