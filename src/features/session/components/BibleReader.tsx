"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import { BOOK_CANON, chapterCountFor, normalizeBookName } from "@/lib/bibles/books";
import { cn } from "@/lib/utils";

/**
 * A Bíblia para LER, dentro do app.
 *
 * ## O que ela não é
 *
 * Ela não é o `PassagePicker` do editor, e a diferença é o produto de cada um:
 * aquele devolve uma REFERÊNCIA para virar bloco, e por isso tem um terceiro
 * passo (a faixa de versículos), um rodapé de confirmar e um `onPick`. Aqui
 * ninguém escolhe nada — a pessoa está consultando, e a consulta termina na
 * leitura. Fundir os dois num componente com bandeira seria um `if` por linha,
 * e o terceiro passo do seletor apareceria escondido atrás de uma prop em
 * metade das telas.
 *
 * Ela também não é o `ChapterDialog`. Aquele abre num capítulo que o texto já
 * nomeou ("Jonas 1", tocado no meio de um parágrafo) e é uma FOLHA: mostra e
 * fecha. Aqui não há referência de partida, o caminho começa nos 66 livros, e é
 * por isso que ela navega em vez de só mostrar.
 *
 * ## Dois passos, e o segundo já é a leitura
 *
 * Livro → capítulo, e o capítulo escolhido já desenha o texto embaixo da
 * grade, na mesma tela. O seletor do editor precisa de três porque precisa da
 * faixa; aqui um terceiro passo seria pedir que a pessoa escolha versículos
 * para poder ler o capítulo, que é o contrário do que ela veio fazer.
 *
 * As setas do cabeçalho andam de capítulo sem voltar à grade: ler o fim de um
 * capítulo e querer o começo do seguinte é o gesto mais comum de uma Bíblia,
 * e ele não pode custar dois toques e uma grade de 150 números.
 *
 * ## Ela é uma REGIÃO, não um diálogo
 *
 * É o que a torna reusável em toda tela que a pede — o `BibleDock`, o MESMO
 * componente, monta a mesma região dentro de uma gaveta na leitura, no editor
 * e no gravador. Quem quiser um diálogo põe isto dentro de um; o contrário não
 * daria — um componente que carrega o próprio `Dialog` não entra numa aba.
 *
 * O texto vem do MESMO `useVerseFetch` do resto do app, cacheado por
 * referência com `staleTime` infinito: folhear ida e volta não repete busca
 * nenhuma.
 */

type Props = {
  className?: string;
  /** Livro e capítulo em que a leitura abre. Sem isso ela começa na lista. */
  initialBook?: string;
  initialChapter?: number;
};

const BOOK_ITEM = cn(
  "flex w-full items-baseline gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] text-v2-ink-soft",
  "transition-colors hover:bg-v2-card hover:text-v2-ink active:translate-y-px",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
);

const CHAPTER_ITEM = cn(
  "inline-flex h-10 items-center justify-center rounded-xl text-[13px] tabular-nums transition-colors active:translate-y-px",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
);

export function BibleReader({ className, initialBook, initialChapter }: Props) {
  const [book, setBook] = useState<string | null>(initialBook ?? null);
  const [chapter, setChapter] = useState<number | null>(
    initialBook && initialChapter ? initialChapter : null
  );
  const [query, setQuery] = useState("");

  const books = useMemo(() => {
    const q = normalizeBookName(query);
    if (!q) return BOOK_CANON;
    return BOOK_CANON.filter(
      (b) => normalizeBookName(b.name).includes(q) || normalizeBookName(b.abbrev).includes(q)
    );
  }, [query]);

  const chapterCount = book ? chapterCountFor(book) : 0;
  const reference = book && chapter ? `${book} ${chapter}` : null;
  const state = useVerseFetch(reference);

  const go = (delta: number) => {
    if (!chapter) return;
    const next = chapter + delta;
    if (next < 1 || next > chapterCount) return;
    setChapter(next);
  };

  if (!book) {
    return (
      <div className={cn("flex min-h-0 flex-col gap-3", className)}>
        <label className="relative block shrink-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-v2-ink-mute"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar um livro"
            aria-label="Procurar um livro da Bíblia"
            className="w-full rounded-full bg-v2-card py-2.5 pr-4 pl-9 text-[13.5px] text-v2-ink placeholder:text-v2-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {books.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] font-light text-v2-ink-mute">
              Nenhum livro com esse nome.
            </p>
          ) : (
            <ul>
              {books.map((b) => (
                <li key={b.abbrev}>
                  <button
                    type="button"
                    className={BOOK_ITEM}
                    onClick={() => {
                      setBook(b.name);
                      setChapter(null);
                    }}
                  >
                    <span className="flex-1">{b.name}</span>
                    <span className="text-[11px] text-v2-ink-mute">{b.abbrev}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* O cabeçalho carrega as DUAS navegações: voltar um passo (o × do
          caminho) e andar de capítulo (o gesto de quem está lendo). As setas
          só existem com um capítulo aberto, porque é só aí que "o próximo"
          quer dizer alguma coisa. */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => (chapter ? setChapter(null) : setBook(null))}
          aria-label={chapter ? "Escolher outro capítulo" : "Escolher outro livro"}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
        <span className="flex-1 truncate text-[14px] font-normal text-v2-ink">
          {chapter ? `${book} ${chapter}` : book}
        </span>
        {chapter ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={chapter <= 1}
              aria-label="Capítulo anterior"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card hover:text-v2-ink disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
            >
              <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={chapter >= chapterCount}
              aria-label="Próximo capítulo"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card hover:text-v2-ink disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
            >
              <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!chapter ? (
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setChapter(n)}
                className={cn(CHAPTER_ITEM, "text-v2-ink-soft hover:bg-v2-card hover:text-v2-ink")}
              >
                {n}
              </button>
            ))}
          </div>
        ) : state.status === "ok" && state.verses.length > 0 ? (
          <VerseLines verses={state.verses} />
        ) : state.status === "error" || state.status === "ok" ? (
          <p className="px-3 py-6 text-center text-[13px] font-light text-v2-ink-mute">
            Não consegui buscar este capítulo agora. Confira sua conexão e tente de novo.
          </p>
        ) : (
          <div aria-hidden className="flex flex-col gap-2 pl-3">
            {["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[95%]", "w-[90%]"].map((w, i) => (
              <span
                key={w}
                className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${w}`}
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
