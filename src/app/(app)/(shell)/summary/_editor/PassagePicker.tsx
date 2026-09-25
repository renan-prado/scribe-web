"use client";

import { ArrowLeft, BookOpen, Info, Plus } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { TranslationCredit } from "@/features/session/components/TranslationCredit";
import { useResolvedTranslation } from "@/features/session/components/TranslationScope";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import {
  abbrevFor,
  BOOK_CANON,
  chapterCountFor,
  chapterVerseCount,
  normalizeBookName,
} from "@/lib/bibles/books";
import type { TranslationId } from "@/lib/bibles/translations";
import { parseVerseReference } from "@/lib/domain/reference";
import type { VerseLine } from "@/lib/domain/verse";
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
 * reabrir tudo e refazer livro e capítulo. Com o botão de citar, o segundo toque só
 * desenha a faixa, um terceiro recomeça dali (como em todo seletor de período),
 * e sair dali é uma decisão à parte.
 *
 * **O terceiro passo MOSTRA O TEXTO, e é ele que responde "é esta mesmo?".**
 * A grade de números sozinha pedia uma escolha que só podia ser conferida
 * depois, com o bloco já no documento: quem não sabe o versículo de cor
 * escolhia 16, fechava, lia, e voltava para corrigir. A prévia abre no
 * CAPÍTULO inteiro — dá para procurar a frase ali mesmo — e, ao primeiro
 * toque na grade, encolhe para o que foi escolhido, que é a mesma coisa que o
 * bloco vai mostrar.
 *
 * **Uma busca só, e ela é a do capítulo.** O texto vem por `useVerseFetch` na
 * referência SEM faixa ("João 3"), e o recorte é um `filter` no cliente.
 * Buscar a faixa a cada toque seria uma requisição por número tocado contra um
 * limite de 60/min, para receber de volta um pedaço de algo que já está na
 * memória. Como bônus, a entrada de cache que isto semeia é exatamente a que a
 * menção de capítulo usa depois (`staleTime` infinito, ver `passageQueryOptions`).
 *
 * **O hover não mexe na prévia.** Ele pinta a faixa na grade, que é uma
 * resposta a um gesto em curso; trocar o TEXTO a cada número sob o mouse
 * transformaria a leitura num piscar. Quem manda na prévia são as pontas
 * fincadas.
 *
 * **O capítulo inteiro é uma escolha legítima**, e a leitura sabe o que fazer
 * com ela: sem faixa de versículos e sem corpo, o `BlockRenderer` desenha a
 * MENÇÃO (`ChapterMention`, uma pastilha clicável que abre o capítulo) em vez
 * da moldura de citação vazia em volta de nada.
 *
 * **Ele abre no passo que a referência recebida já alcança** — e ela pode vir
 * PELA METADE. São três formas, e cada uma pula os passos que já estão
 * respondidos:
 *
 * - `"João 3:16"` (editar um bloco que já tem referência) → passo 3, com o
 *   livro, o capítulo e a faixa acesos. Reabrir do zero uma passagem já
 *   escolhida cobraria os dois primeiros passos de novo só para corrigir o
 *   último versículo por uma casa.
 * - `"João 3"` → passo 3 também, com "capítulo inteiro" marcado: é
 *   literalmente o que essa referência significa no produto (a menção de
 *   capítulo), e o primeiro toque numa grade de versículos a desmarca.
 * - `"João"` → passo 2, na grade de capítulos. É a forma que vem da barra
 *   (`/joao`), onde o livro já foi digitado e pedi-lo de novo numa lista de
 *   66 seria devolver o trabalho já feito.
 *
 * `initialReference` ausente, ou que não resolve contra `lib/bibles/books`,
 * cai no reset de sempre: o passo 1, os 66 livros.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reference: string) => void;
  /**
   * A referência já escolhida (ao EDITAR) ou o começo dela (o livro, ou livro
   * e capítulo, vindos da barra). `null`/inválida = começa do livro.
   */
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

/**
 * O livro por trás de um nome escrito, na forma CANÔNICA — "joao" → "João".
 *
 * A referência parcial que chega da barra já vem canônica (ela é montada a
 * partir de `BOOK_CANON`), mas passar por `abbrevFor` é o que mantém o
 * seletor de pé se um dia ela chegar de outro lugar, escrita de outro jeito:
 * o nome que entra no estado tem de ser o MESMO que `chapterCountFor` e
 * `chapterVerseCount` sabem ler, senão as grades nascem vazias.
 */
function canonNameFor(raw: string): string | null {
  const abbrev = abbrevFor(raw);
  if (!abbrev) return null;
  return BOOK_CANON.find((b) => b.abbrev === abbrev)?.name ?? null;
}

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
  /** O tooltip da dica é CONTROLADO: sem isso o dedo não o abre. Ver `Hint`. */
  const [hintOpen, setHintOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Toda abertura recomeça do livro, A MENOS que já venha uma referência —
  // inteira ou pela metade. Ver o cabeçalho: cada forma pousa no passo que ela
  // alcança, e nenhum passo já respondido é cobrado de novo.
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
    // Só o LIVRO ("João", "/joao" na barra): não há capítulo para o parser
    // achar, e o passo 2 é exatamente o que falta.
    const onlyBook = initialReference ? canonNameFor(initialReference) : null;
    if (onlyBook) {
      setStep("chapter");
      setBook(onlyBook);
      setChapter(null);
      setStart(null);
      setEnd(null);
      setHover(null);
      setWhole(false);
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

  /**
   * A faixa FINCADA — sem o hover, ao contrário de `range`. É ela que recorta
   * a prévia: ver "O hover não mexe na prévia" no cabeçalho. `null` quando
   * ainda não se tocou em nada, ou quando a escolha é o capítulo inteiro, e
   * nos dois casos a prévia mostra o capítulo todo.
   */
  const picked = (() => {
    if (whole || start === null) return null;
    const other = end ?? start;
    return { from: Math.min(start, other), to: Math.max(start, other) };
  })();

  /**
   * O texto do CAPÍTULO, uma vez. `null` fora do passo 3 — o diálogo fica
   * montado o tempo todo (`open` é prop), e sem isto ele pediria o texto de
   * um capítulo que ninguém ainda escolheu.
   */
  const chapterReference = step === "verse" && book && chapter ? `${book} ${chapter}` : null;
  const passage = useVerseFetch(chapterReference);
  // A prévia é lida na tradução de quem está montando o bloco, que é a mesma
  // que `useVerseFetch` acabou de usar (ele cai no contexto quando ninguém
  // passa nada). O crédito tem de falar da tradução que está na TELA, não da
  // padrão do produto.
  const previewTranslation = useResolvedTranslation();
  const previewVerses =
    passage.status === "ok"
      ? picked
        ? passage.verses.filter((v) => v.verse >= picked.from && v.verse <= picked.to)
        : passage.verses
      : [];

  /** O que o botão de citar vai gravar, e o que o rodapé mostra. `null` = nada. */
  const reference = (() => {
    if (!book || !chapter) return null;
    if (whole) return `${book} ${chapter}`;
    if (start === null) return null;
    const to = end ?? start;
    const from = Math.min(start, to);
    const last = Math.max(start, to);
    return from === last ? `${book} ${chapter}:${from}` : `${book} ${chapter}:${from}-${last}`;
  })();

  /**
   * O MESMO recorte, escrito como se digita na barra: "/gn 1:1".
   *
   * É ensino no lugar onde ele cabe: quem chegou até aqui andou três passos
   * para pedir uma passagem, e a barra faz isso numa linha. A dica sai da
   * escolha que está na tela AGORA, não de um exemplo fixo, porque o exemplo
   * genérico é o que a pessoa lê sem se reconhecer; com o livro que ela acabou
   * de procurar, a frase vira a tradução do que ela fez.
   *
   * A sigla, e não o nome por extenso, porque é o que economiza digitação e
   * porque é ela que a barra entende igual (ver `matchBibleQuery`). Sem faixa
   * escolhida ainda, o `:1` é só a forma da coisa.
   */
  const abbrev = book ? BOOK_CANON.find((b) => b.name === book)?.abbrev.toLowerCase() : null;
  const shortcut = (() => {
    if (!book || !chapter || !abbrev) return null;
    return `/${abbrev} ${reference ? reference.slice(book.length + 1) : `${chapter}:1`}`;
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
            <div className="max-h-[30vh] overflow-y-auto" onMouseLeave={() => setHover(null)}>
              <VerseRange
                count={verses}
                range={whole ? null : range}
                anchor={whole ? null : start}
                onHover={setHover}
                onPick={pickVerse}
              />
            </div>
            {/* O DIVISOR é o que separa a grade da prévia agora. Ela já teve
                borda em volta, e a moldura fazia o texto bíblico parecer mais
                um controle do diálogo, ao lado dos outros dois: um fio só diz
                "daqui para baixo é leitura" sem desenhar uma terceira caixa
                numa tela que já tem o botão do capítulo e a grade. */}
            {/* O `my-4` SOMA ao `gap-3` da coluna: 28px de cada lado do fio,
                contra os 12 que o vão sozinho daria. O respiro é a metade do
                trabalho que o divisor faz aqui, porque o que está acima dele
                se TOCA e o que está abaixo se LÊ, e duas listas encostadas num
                fio apertado continuariam parecendo uma coisa só. */}
            <div aria-hidden className="my-4 h-px w-full shrink-0 bg-scriba-hairline" />
            <Preview
              state={passage.status}
              verses={previewVerses}
              translation={previewTranslation}
            />
          </div>
        ) : null}

        {/* O rodapé só existe no terceiro passo: nos dois primeiros, escolher é
            avançar, e um botão de confirmar ali seria um segundo jeito de fazer
            a mesma coisa. */}
        {step === "verse" ? (
          <DialogFooter className="items-center sm:justify-between">
            {/* `gap-2`, e não o vão de duas linhas de um mesmo parágrafo: a
                referência é o ESTADO da escolha e a dica é outro assunto, e
                coladas elas liam como uma frase de duas linhas. */}
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-sm text-scriba-ink-mute tabular-nums">
                {reference ?? "Toque no primeiro versículo"}
              </p>
              {/* SUTIL de propósito: ela não é uma instrução a seguir agora, é
                  uma porta que fica sabida para a próxima vez. Em 11px e na
                  tinta mais apagada, quem está escolhendo versículo não é
                  interrompido; quem já terminou tem o olho livre para ler a
                  linha de baixo. */}
              {shortcut && abbrev ? (
                <p className="flex items-center gap-1.5 text-[11px] text-scriba-ink-mute/80">
                  Atalho:
                  {/* O fundo é o que separa COMANDO de frase: sem ele, "/gn
                      1:1" no meio do texto lê como continuação da linha, e o
                      que se quer ensinar é que aquilo se DIGITA, letra por
                      letra. O véu é a mesma tinta clara dos realces deste
                      diálogo (`VEIL_*`), porque cinza literal aqui seria a cor
                      do próprio popup. */}
                  <code className="rounded bg-scriba-ink-strong/10 px-1.5 py-px font-mono text-scriba-ink">
                    {shortcut}
                  </code>
                  <Hint
                    abbrev={abbrev}
                    chapter={chapter ?? 1}
                    open={hintOpen}
                    onOpenChange={setHintOpen}
                  />
                </p>
              ) : null}
            </div>
            {/* "Citar…", e não "Concluir". O verbo diz o que o botão FAZ com o
                que está escolhido, e o `+` é o mesmo sinal de acrescentar do
                resto do editor: o que sai daqui é um bloco novo no texto, não
                o fim de um formulário. O rótulo acompanha a escolha porque ela
                cabe em duas frases diferentes, e um "Citar versículos" com o
                capítulo inteiro marcado seria o botão dizendo outra coisa. */}
            <Button size="lg" disabled={!reference} onClick={confirm}>
              <Plus className="size-4" strokeWidth={2.5} />
              {whole ? "Citar capítulo" : "Citar versículos"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * O `(i)` ao lado do atalho, e o que ele conta.
 *
 * **A linha de baixo do rodapé só cabe o atalho**, e o atalho sozinho não
 * ensina: falta onde se digita, e falta que ele tem TRÊS formas, cada uma
 * parando num lugar diferente. Isso é um parágrafo, e um parágrafo no rodapé
 * de um diálogo de escolha seria ruído em cima de quem veio escolher um
 * versículo. Atrás de um `(i)`, ele fica para quem PERGUNTOU.
 *
 * **Os exemplos usam o livro que está na tela**, como o atalho logo ao lado: um
 * "/gn" genérico se lê sem se reconhecer; "/{sigla do livro que acabei de
 * procurar}" é a tradução do que a pessoa está fazendo agora.
 *
 * **Ele é CONTROLADO por causa do dedo.** O tooltip do base-ui abre no hover e
 * no foco, e nenhum dos dois existe no celular, que é onde este diálogo mais
 * roda. O `onClick` abre, e o `onOpenChange` continua entregando o hover de
 * quem tem mouse: as duas portas, um estado só.
 */
function Hint({
  abbrev,
  chapter,
  open,
  onOpenChange,
}: {
  abbrev: string;
  chapter: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const line = (command: string, what: string) => (
    <li className="flex items-baseline gap-1.5">
      <code className="shrink-0 whitespace-nowrap rounded bg-background/15 px-1 py-px font-mono">
        {command}
      </code>
      <span className="opacity-80">{what}</span>
    </li>
  );
  return (
    <TooltipProvider delay={120}>
      <Tooltip open={open} onOpenChange={onOpenChange}>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Como usar o atalho"
              onClick={() => onOpenChange(!open)}
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-scriba-ink-mute transition-colors hover:text-scriba-ink focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          }
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-1.5 py-2 text-left">
          <p>
            Numa linha em branco do texto, escreva <code className="font-mono">/</code> e o livro.
            Assim, você poderá citar um livro, capítulo e versículo com mais facilidade.
          </p>
          <ul className="flex flex-col gap-1">
            {line(`/${abbrev}`, "abre no livro")}
            {line(`/${abbrev} ${chapter}`, "abre no capítulo")}
            {line(`/${abbrev} ${chapter}:1`, "insere a passagem diretamente")}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * A prévia: o texto do que está escolhido, na NVI.
 *
 * **A mesma marcação da leitura** (`VerseLines`), e não uma lista própria: é
 * exatamente o que o bloco vai mostrar depois, e duas marcações divergiriam na
 * primeira vez que alguém mexesse no alinhamento do número sobrescrito.
 *
 * **Sem moldura, só um fio acima dela.** Com borda em volta, o texto bíblico
 * lia como mais um controle do diálogo, ao lado do botão do capítulo e da
 * grade; o divisor diz a mesma coisa sem desenhar uma terceira caixa.
 *
 * Ela tem rolagem PRÓPRIA, separada da grade logo acima: são duas listas que
 * crescem (o Salmo 119 tem 176 versículos), e uma única área rolável faria a
 * grade sumir por cima enquanto se lê o texto — justamente quando se quer
 * tocar no número seguinte.
 *
 * Falha e capítulo sem texto dizem a MESMA frase curta, e nenhuma das duas
 * impede a escolha: a grade continua ali, montada sobre
 * `CHAPTER_VERSE_COUNTS`, que não depende de rede nenhuma. A prévia é uma
 * ajuda, não um passo.
 */
function Preview({
  state,
  verses,
  translation,
}: {
  state: "idle" | "loading" | "ok" | "error";
  verses: VerseLine[];
  translation: TranslationId;
}) {
  return (
    <div className="max-h-[28vh] min-h-24 overflow-y-auto">
      {state === "ok" && verses.length > 0 ? (
        <>
          <VerseLines muted verses={verses} />
          {/* O crédito da licença, DENTRO da rolagem e depois do último
              versículo: ele credita o texto que está acima dele, e fora da
              área rolável seria uma faixa fixa de três linhas num diálogo que
              já disputa altura com a grade de números. Só existe quando há
              texto na tela — sem versículo não há reprodução a creditar. */}
          <TranslationCredit translation={translation} className="mr-1 ml-3" />
        </>
      ) : state === "error" || (state === "ok" && verses.length === 0) ? (
        <p className="px-1 py-4 text-center text-scriba-ink-mute text-sm">
          Não consegui carregar o texto agora. Dá para escolher assim mesmo.
        </p>
      ) : (
        <div aria-hidden className="flex flex-col gap-2 pl-3 pt-1">
          {["w-full", "w-[92%]", "w-[97%]", "w-[85%]"].map((w, i) => (
            <span
              key={w}
              style={{ animationDelay: `${i * 90}ms` }}
              className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${w}`}
            />
          ))}
        </div>
      )}
    </div>
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
