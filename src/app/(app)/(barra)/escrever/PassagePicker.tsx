"use client";

import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  abbrevFor,
  BOOK_CANON,
  chapterCountFor,
  chapterVerseCount,
  normalizeBookName,
} from "@/lib/bibles/books";
import { parseVerseReference } from "@/lib/domain/reference";
import { cn } from "@/lib/utils";

/**
 * O seletor de passagem: livro → capítulo → versículos.
 *
 * **Ele devolve uma REFERÊNCIA, e nada mais.** O bloco `bibleQuote` é gravado
 * com `text` vazio, e é o `PassageVerses` que busca a NVI — na edição e na
 * leitura, o mesmo caminho que um bloco escrito pela IA já percorre. Guardar
 * aqui uma cópia do texto bíblico criaria uma segunda fonte para a mesma
 * passagem, que envelhece sozinha e não tem como ser conferida depois.
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
 * **A faixa se escolhe como num calendário: dois toques, com a seleção pintada
 * entre eles.** O primeiro finca a ponta, o segundo fecha; entre um e outro, o
 * caminho até o número sob o mouse já aparece pintado, e é ISSO que responde
 * "quanto eu estou pegando?" antes de o segundo toque acontecer. A versão
 * anterior mostrava só o primeiro número aceso e uma frase explicando o que
 * fazer a seguir — a pessoa escolhia os dois extremos sem nunca ver a faixa.
 *
 * **E o terceiro passo agora termina num botão, não no toque.** Fechar a faixa
 * fechava o diálogo junto: quem errava o último versículo por uma casa tinha de
 * reabrir tudo e refazer livro e capítulo. Com o `Concluir`, o segundo toque só
 * desenha a faixa, um terceiro recomeça dali (como em todo seletor de período),
 * e sair dali é uma decisão à parte.
 *
 * **O capítulo inteiro é uma escolha legítima**, e a leitura sabe o que fazer
 * com ela: sem faixa de versículos e sem corpo, o `BlockRenderer` desenha a
 * MENÇÃO (`ChapterMention`, uma pastilha clicável que abre o capítulo) em vez
 * da moldura de citação vazia em volta de nada.
 *
 * **Editando uma referência que já existe, ele abre no passo 3, já com o
 * livro, o capítulo e a faixa daquela referência** (`initialReference`), em
 * vez de recomeçar do livro. Reabrir do zero uma passagem que já foi
 * escolhida cobra os dois primeiros passos de novo só para corrigir o
 * versículo errado por uma casa. `initialReference` ausente ou que não
 * resolve contra `lib/bibles/books` (um bloco novo, sem referência ainda) cai
 * no reset de sempre.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reference: string) => void;
  /** A referência já escolhida, ao EDITAR. `null`/inválida = bloco novo. */
  initialReference?: string | null;
};

type Step = "book" | "chapter" | "verse";

/**
 * **Dentro deste diálogo, realce é VÉU BRANCO, e não `blue-soft`.**
 *
 * O popup tem `bg-popover`, que é `#2F3035` — exatamente o valor de
 * `--scriba-blue-soft`. Todo `hover:bg-scriba-blue-soft` daqui pintava cinza
 * sobre o mesmo cinza: o toque não respondia nada, e a faixa de versículos
 * escolhida ficava invisível entre as duas pontas brancas. Uma película da
 * tinta clara sobre o que estiver embaixo não tem esse problema, porque ela não
 * é uma cor, é um degrau.
 *
 * Os três níveis são a mesma tinta em forças diferentes, e é isso que os faz
 * ler como uma escala: passar o mouse < apertar ≤ estar escolhido < ser a ponta
 * (que é a tinta cheia, com o número invertido).
 *
 * As constantes guardam a classe INTEIRA, com a variante junto, e não só a cor.
 * O Tailwind lê o arquivo procurando nomes de classe completos: um
 * `hover:${VEIL}` montado com template nunca aparece no código, e a regra
 * simplesmente não é gerada — o realce some sem erro nenhum, que é a segunda
 * maneira de a mesma coisa ficar invisível.
 */
const VEIL_HOVER = "hover:bg-scriba-ink-strong/10";
const VEIL_ACTIVE = "active:bg-scriba-ink-strong/20";
const VEIL_RANGE = "bg-scriba-ink-strong/25";

/**
 * O vestido de um item escolhível — um livro, um capítulo.
 *
 * O `active:` é o que faltava: num diálogo em que todo toque troca a tela
 * inteira, `hover:` não existe no celular e `focus-visible:` só aparece para
 * quem navega por teclado. Sem ele o dedo pousa no número e nada acontece até a
 * tela seguinte chegar — e, se ela demora um quadro, o toque parece não ter
 * sido registrado. O par é o do resto do app: um degrau de fundo e o
 * `translate-y-px` de botão apertado.
 */
const LIST_ITEM = cn(
  "text-scriba-ink transition-colors active:translate-y-px",
  VEIL_HOVER,
  VEIL_ACTIVE,
  "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
);

export function PassagePicker({ open, onOpenChange, onPick, initialReference }: Props) {
  const [step, setStep] = useState<Step>("book");
  const [book, setBook] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  /** A ponta fincada pelo primeiro toque. */
  const [start, setStart] = useState<number | null>(null);
  /** A outra ponta, quando o segundo toque já aconteceu. */
  const [end, setEnd] = useState<number | null>(null);
  /** O número sob o mouse, que é o que pinta a faixa antes do segundo toque. */
  const [hover, setHover] = useState<number | null>(null);
  /** "O capítulo inteiro" é uma terceira escolha, e exclui a faixa. */
  const [whole, setWhole] = useState(false);
  const [query, setQuery] = useState("");

  // Toda abertura recomeça do livro, A MENOS que exista uma referência já
  // escolhida (editar um bloco existente): aí ela pousa direto no passo 3,
  // com aquele livro, capítulo e faixa. Um seletor que reabre sempre no
  // primeiro passo obriga quem quer só corrigir o último versículo a refazer
  // livro e capítulo de novo.
  useEffect(() => {
    if (!open) return;
    const parsed = initialReference ? parseVerseReference(initialReference) : null;
    const canon = parsed && abbrevFor(parsed.bookDisplay) ? parsed.bookDisplay : null;
    const chapters = canon ? chapterCountFor(canon) : 0;
    if (parsed && canon && parsed.chapter >= 1 && parsed.chapter <= chapters) {
      setStep("verse");
      setBook(canon);
      setChapter(parsed.chapter);
      if (parsed.startVerse != null) {
        setWhole(false);
        setStart(parsed.startVerse);
        setEnd(parsed.endVerse ?? parsed.startVerse);
      } else {
        setWhole(true);
        setStart(null);
        setEnd(null);
      }
      setHover(null);
      setQuery("");
      return;
    }
    setStep("book");
    setBook(null);
    setChapter(null);
    setStart(null);
    setEnd(null);
    setHover(null);
    setWhole(false);
    setQuery("");
  }, [open, initialReference]);

  const books = useMemo(() => {
    const q = normalizeBookName(query);
    if (!q) return BOOK_CANON;
    return BOOK_CANON.filter((b) => normalizeBookName(b.name).includes(q));
  }, [query]);

  const chapters = book ? chapterCountFor(book) : 0;
  const verses = book && chapter ? (chapterVerseCount(book, chapter) ?? 0) : 0;

  /**
   * A faixa que está na tela AGORA — a fechada, ou a que o mouse está
   * desenhando. É uma coisa só de propósito: a grade pinta o que existe, sem
   * precisar saber se aquilo já foi confirmado.
   */
  const range = (() => {
    if (start === null) return null;
    const other = end ?? hover ?? start;
    return { from: Math.min(start, other), to: Math.max(start, other) };
  })();

  /** O que o `Concluir` vai gravar, e o que o rodapé mostra. `null` = nada. */
  const reference = (() => {
    if (!book || !chapter) return null;
    if (whole) return `${book} ${chapter}`;
    if (start === null) return null;
    const to = end ?? start;
    const from = Math.min(start, to);
    const last = Math.max(start, to);
    return from === last ? `${book} ${chapter}:${from}` : `${book} ${chapter}:${from}-${last}`;
  })();

  function confirm() {
    if (!reference) return;
    onPick(reference);
    onOpenChange(false);
  }

  /**
   * Um toque na grade, com as três respostas de um seletor de período: finca,
   * fecha, ou recomeça.
   */
  function pickVerse(v: number) {
    setWhole(false);
    if (start === null || end !== null) {
      setStart(v);
      setEnd(null);
      return;
    }
    setEnd(v);
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
                    setEnd(null);
                    setWhole(false);
                    setStep("chapter");
                  } else {
                    setStep("book");
                  }
                }}
                className={cn(
                  "-ml-1 inline-flex size-7 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:text-scriba-ink active:translate-y-px",
                  VEIL_HOVER,
                  VEIL_ACTIVE
                )}
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            {step === "book" ? "Escolha o livro" : step === "chapter" ? book : `${book} ${chapter}`}
          </DialogTitle>
          {/* `sr-only`: na TELA a legenda não dizia nada que o título já não
              dissesse ("Escolha o livro" seguido de "os 66 livros, na ordem da
              Bíblia"), e no terceiro passo quem conta o que está escolhido é o
              rodapé, que mostra a referência se formando. Para quem ouve a
              tela, porém, é aqui que a mecânica da faixa cabe — ela não tem
              como ser vista. */}
          <DialogDescription className="sr-only">
            {step === "book"
              ? "Procure ou escolha um dos 66 livros."
              : step === "chapter"
                ? "Escolha o capítulo."
                : "Escolha o primeiro e o último versículo da faixa, ou cite o capítulo inteiro."}
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
                        className={cn(
                          LIST_ITEM,
                          "w-full truncate rounded-lg px-3 py-2 text-left text-sm"
                        )}
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
              aria-pressed={whole}
              onClick={() => {
                setWhole(true);
                setStart(null);
                setEnd(null);
              }}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                "active:translate-y-px",
                whole
                  ? "border-transparent bg-scriba-ink-strong text-scriba-surface"
                  : cn("border-scriba-hairline text-scriba-ink-soft", VEIL_HOVER, VEIL_ACTIVE)
              )}
            >
              <BookOpen className="size-4" />
              Citar o capítulo inteiro
            </button>
            {/* O `onMouseLeave` aqui só APAGA a faixa de prévia quando o
                ponteiro sai da grade; não há ação atrás deste `div`. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: ver acima */}
            <div className="max-h-[44vh] overflow-y-auto" onMouseLeave={() => setHover(null)}>
              <VerseRange
                count={verses}
                range={whole ? null : range}
                anchor={whole ? null : start}
                onHover={setHover}
                onPick={pickVerse}
              />
            </div>
          </div>
        ) : null}

        {/* O rodapé só existe no terceiro passo: nos dois primeiros, escolher é
            avançar, e um botão de confirmar ali seria um segundo jeito de fazer
            a mesma coisa. */}
        {step === "verse" ? (
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-sm text-scriba-ink-mute tabular-nums">
              {reference ?? "Toque no primeiro versículo"}
            </p>
            <Button size="lg" disabled={!reference} onClick={confirm}>
              Concluir
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** As colunas da grade de versículos, nos dois tamanhos de tela. */
const COLS_NARROW = 6;
const COLS_WIDE = 8;

/**
 * Quantas colunas a grade tem AGORA.
 *
 * As pontas da fita dependem de saber onde uma linha termina, e isso é uma
 * conta (`(n - 1) % colunas`), não um seletor. A versão anterior tentou fazer
 * isso em CSS, com `nth-[6n]` e `nth-[8n]` numa grade responsiva, e as regras
 * de seis continuavam valendo na grade de oito: sobravam cantos arredondados no
 * MEIO da faixa, a cada sexto número, e a fita virava uma fileira de pastilhas.
 *
 * O `40rem` é o `sm` do Tailwind, e ele e o `sm:grid-cols-8` da grade têm de
 * mudar juntos — é a única linha deste arquivo em que um número precisa
 * concordar com uma classe.
 */
function useGridColumns(): number {
  const [cols, setCols] = useState(COLS_NARROW);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 40rem)");
    const apply = () => setCols(mq.matches ? COLS_WIDE : COLS_NARROW);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return cols;
}

/**
 * A grade dos VERSÍCULOS, com a faixa pintada de ponta a ponta.
 *
 * **Sem vão entre as colunas**, ao contrário da grade de capítulos: a faixa é
 * uma fita contínua, e com 6px entre as células ela viraria uma fileira de
 * pastilhas soltas. O vão fica só entre as LINHAS, que é o que separa uma
 * quebra da seguinte.
 *
 * **As pontas da fita são as do INTERVALO e as das LINHAS.** Uma faixa de 8 a
 * 20 quebra no meio da grade, e o pedaço que continua na linha de baixo tem de
 * começar reto, senão parecem duas seleções. Quem sabe onde a linha quebra é a
 * conta com `useGridColumns`, e não um seletor `nth-*`: numa grade responsiva
 * as regras de seis colunas continuavam valendo na grade de oito, e sobravam
 * cantos no meio da faixa.
 *
 * Alvos de 40px de altura, e não os 28 que caberiam: esta é a única parte do
 * editor que se usa exclusivamente com o dedo. Os `tabular-nums` mantêm 1 e 150
 * com a mesma largura, senão a grade treme conforme os números crescem.
 */
function VerseRange({
  count,
  range,
  anchor,
  onHover,
  onPick,
}: {
  count: number;
  range: { from: number; to: number } | null;
  /** A ponta fincada: ela fica acesa mesmo antes de haver faixa. */
  anchor: number | null;
  onHover: (n: number | null) => void;
  onPick: (n: number) => void;
}) {
  const cols = useGridColumns();

  if (count < 1) {
    return (
      <p className="px-1 py-6 text-center text-scriba-ink-mute text-sm">
        Não encontrei este texto na NVI.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-6 gap-y-1 sm:grid-cols-8">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const inside = range !== null && n >= range.from && n <= range.to;
        const isCap = inside && (n === range.from || n === range.to || n === anchor);
        // A fita acaba onde o intervalo acaba E onde a linha acaba: o pedaço
        // que continua na linha de baixo começa reto, como uma frase que vira a
        // página.
        const column = (n - 1) % cols;
        const roundLeft = inside && (n === range.from || column === 0);
        const roundRight = inside && (n === range.to || column === cols - 1 || n === count);
        return (
          <li key={n}>
            <button
              type="button"
              onClick={() => onPick(n)}
              onMouseEnter={() => onHover(n)}
              onFocus={() => onHover(n)}
              className={cn(
                "flex h-10 w-full items-center justify-center text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                // O afundar do toque vale para TODA célula, escolhida ou não:
                // é ele que responde ao dedo antes de a faixa mudar.
                "active:translate-y-px",
                // A fita é um VÉU da mesma tinta das pontas, e não um cinza:
                // ver `VEIL_RANGE`. Com `blue-soft` ela era literalmente da cor
                // do diálogo, e os números do meio da faixa ficavam iguais aos
                // que sobraram de fora.
                inside && !isCap && cn(VEIL_RANGE, "font-medium text-scriba-ink-strong"),
                isCap && "bg-scriba-ink-strong font-semibold text-scriba-surface",
                // Fora da faixa a célula é uma pastilha inteira: o realce do
                // mouse não tem fita a que se emendar.
                !inside && cn("rounded-lg text-scriba-ink", VEIL_HOVER, VEIL_ACTIVE),
                roundLeft && "rounded-l-lg",
                roundRight && "rounded-r-lg"
              )}
            >
              {n}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A grade de números do segundo passo, o dos capítulos.
 *
 * Escolher capítulo é um toque só e avança de tela, então aqui não há faixa
 * nem estado: é uma lista de botões em grade. Ver `VerseRange` para o terceiro
 * passo, onde a escolha tem dois extremos.
 */
function NumberGrid({ count, onPick }: { count: number; onPick: (n: number) => void }) {
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
              LIST_ITEM,
              "flex size-10 items-center justify-center rounded-lg text-sm tabular-nums"
            )}
          >
            {n}
          </button>
        </li>
      ))}
    </ul>
  );
}
