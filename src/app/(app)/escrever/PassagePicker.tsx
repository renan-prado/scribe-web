"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BOOK_CANON,
  chapterCountFor,
  chapterVerseCount,
  normalizeBookName,
} from "@/lib/bibles/books";
import { cn } from "@/lib/utils";

/**
 * O seletor de passagem: livro → capítulo → versículos.
 *
 * **Ele devolve uma REFERÊNCIA, e nada mais.** O bloco `bibleQuote` é gravado
 * com `text` vazio, e é o `PassageVerses` que busca a NVI na hora de ler — o
 * mesmo caminho que um bloco escrito pela IA já percorre. Guardar aqui uma
 * cópia do texto bíblico criaria uma segunda fonte para a mesma passagem, que
 * envelhece sozinha e não tem como ser conferida depois.
 *
 * **Três passos, e não três campos lado a lado.** Capítulo e versículo só
 * existem depois do livro (Obadias tem um capítulo, Salmos tem 150), e um
 * formulário com os três abertos ao mesmo tempo aceita "Obadias 4:9" e só
 * descobre o erro quando a tela mostra um bloco vazio. Aqui só é possível
 * escolher o que existe: as grades são montadas a partir de
 * `CHAPTER_VERSE_COUNTS`.
 *
 * **A faixa é dentro de UM capítulo**, e isso é limite do vocabulário, não do
 * seletor: `parseVerseReference` entende "João 3:16-18" e não tem como
 * representar "João 3:16 a 4:2". Duas passagens, dois blocos — que é também
 * como elas seriam lidas.
 *
 * **O capítulo inteiro é uma escolha legítima**, e a leitura sabe o que fazer
 * com ela: sem faixa de versículos e sem corpo, o `BlockRenderer` desenha a
 * MENÇÃO (`ChapterMention`, uma pastilha clicável que abre o capítulo) em vez
 * da moldura de citação vazia em volta de nada.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reference: string) => void;
};

type Step = "book" | "chapter" | "verse";

export function PassagePicker({ open, onOpenChange, onPick }: Props) {
  const [step, setStep] = useState<Step>("book");
  const [book, setBook] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Toda abertura recomeça do livro. Um seletor que reabre no terceiro passo
  // da vez anterior obriga quem quer outra passagem a voltar dois passos antes
  // de poder escolher, e é a MESMA caixa para os dois casos.
  useEffect(() => {
    if (!open) return;
    setStep("book");
    setBook(null);
    setChapter(null);
    setStart(null);
    setQuery("");
  }, [open]);

  const books = useMemo(() => {
    const q = normalizeBookName(query);
    if (!q) return BOOK_CANON;
    return BOOK_CANON.filter((b) => normalizeBookName(b.name).includes(q));
  }, [query]);

  const chapters = book ? chapterCountFor(book) : 0;
  const verses = book && chapter ? (chapterVerseCount(book, chapter) ?? 0) : 0;

  function choose(reference: string) {
    onPick(reference);
    onOpenChange(false);
  }

  function pickVerse(v: number) {
    if (start === null) {
      setStart(v);
      return;
    }
    // O segundo toque fecha a faixa, em qualquer ordem: quem toca 18 e depois
    // 16 quis os mesmos três versículos.
    const from = Math.min(start, v);
    const to = Math.max(start, v);
    choose(from === to ? `${book} ${chapter}:${from}` : `${book} ${chapter}:${from}-${to}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "book" ? (
              <button
                type="button"
                aria-label="Voltar"
                onClick={() => {
                  if (step === "verse") {
                    setStart(null);
                    setStep("chapter");
                  } else {
                    setStep("book");
                  }
                }}
                className="-ml-1 inline-flex size-7 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:bg-scriba-blue-soft/60 hover:text-scriba-ink"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            {step === "book" ? "Escolha o livro" : step === "chapter" ? book : `${book} ${chapter}`}
          </DialogTitle>
          <DialogDescription>
            {step === "book"
              ? "Os 66 livros, na ordem da Bíblia."
              : step === "chapter"
                ? "Qual capítulo."
                : start === null
                  ? "Toque no primeiro versículo. Para um só, toque nele duas vezes."
                  : `A partir do ${start}. Toque no último da faixa.`}
          </DialogDescription>
        </DialogHeader>

        {step === "book" ? (
          <div className="flex min-h-0 flex-col gap-3">
            <input
              // A caixa de procurar É a tela do primeiro passo; abrir com o
              // cursor fora dela pediria um toque para começar a digitar.
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar livro"
              aria-label="Procurar livro"
              className="w-full rounded-xl border border-scriba-hairline bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-scriba-ink-mute/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="max-h-[52vh] overflow-y-auto">
              {books.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-scriba-ink-mute">
                  Nenhum livro com esse nome.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {books.map((b) => (
                    <li key={b.abbrev}>
                      <button
                        type="button"
                        onClick={() => {
                          setBook(b.name);
                          setStep("chapter");
                        }}
                        className="w-full truncate rounded-lg px-3 py-2 text-left text-sm text-scriba-ink transition-colors hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        {b.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {step === "chapter" ? (
          <div className="max-h-[56vh] overflow-y-auto">
            <NumberGrid
              count={chapters}
              onPick={(n) => {
                setChapter(n);
                setStart(null);
                setStep("verse");
              }}
            />
          </div>
        ) : null}

        {step === "verse" ? (
          <div className="flex min-h-0 flex-col gap-3">
            <button
              type="button"
              onClick={() => choose(`${book} ${chapter}`)}
              className="w-full rounded-xl border border-scriba-hairline px-3.5 py-2.5 text-sm font-medium text-scriba-ink-soft transition-colors hover:bg-scriba-blue-soft/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Citar o capítulo inteiro
            </button>
            <div className="max-h-[48vh] overflow-y-auto">
              <NumberGrid count={verses} selected={start} onPick={pickVerse} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A grade de números de capítulo e de versículo.
 *
 * Alvos de 40px, e não os 28 que caberiam: esta é a única parte do editor que
 * se usa exclusivamente com o dedo, e errar o versículo significa voltar dois
 * passos. Os `tabular-nums` mantêm 1 e 150 com a mesma largura, senão a grade
 * treme conforme os números crescem.
 */
function NumberGrid({
  count,
  selected,
  onPick,
}: {
  count: number;
  selected?: number | null;
  onPick: (n: number) => void;
}) {
  if (count < 1) {
    return (
      <p className="px-1 py-6 text-center text-sm text-scriba-ink-mute">
        Não encontrei este texto na NVI.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <li key={n}>
          <button
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              selected === n
                ? "bg-scriba-blue-soft font-semibold text-scriba-blue-ink"
                : "text-scriba-ink hover:bg-scriba-blue-soft/60"
            )}
          >
            {n}
          </button>
        </li>
      ))}
    </ul>
  );
}
