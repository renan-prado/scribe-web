"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { VerseLines } from "@/features/session/components/PassageVerses";
import { useBibleSearch } from "@/features/session/hooks/useBibleSearch";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import { BOOK_CANON, chapterCountFor, normalizeBookName } from "@/lib/bibles/books";
import {
  BIBLE_SEARCH_MAX_QUESTION_CHARS,
  type BibleSearchPassage,
} from "@/lib/domain/bible-search";
import { joinVerses } from "@/lib/domain/verse";
import { cn } from "@/lib/utils";
import { BibloAvatar } from "@/shared/brand";

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
 *
 * ## A BUSCA POR SENTIDO é a mesma tela do livro, atrás de um alternador
 *
 * "Procurar um livro" é uma busca EXATA — sobrenome de livro, sigla — e
 * sempre foi. Ela não responde "versículos sobre perdão", porque não é essa
 * pergunta que um índice de nomes sabe responder. "Perguntar ao Biblo" é a
 * outra metade, `useBibleSearch` (que chama `POST /api/bible-search`): a
 * pergunta vai ao modelo, que devolve REFERÊNCIAS (nunca o texto, mesma regra
 * do resumo), ancoradas contra a NVI local no servidor antes de chegar aqui.
 *
 * As duas moram na MESMA tela — a de quando nenhum livro está aberto — atrás
 * de um alternador, porque as duas resolvem a mesma pergunta ("que passagem eu
 * quero ler?") por dois caminhos diferentes, e nunca ao mesmo tempo.
 *
 * **"Ir para a passagem" usa o MESMO `book`/`chapter` que o resto do
 * componente**, não um estado paralelo: um resultado da busca é só mais um
 * jeito de chegar num capítulo, como tocar num livro da lista. O que ele
 * acrescenta é o destaque no versículo certo, resolvido depois que o texto do
 * capítulo termina de chegar (`pendingHighlight`, mais abaixo) — reaproveita a
 * MESMA classe de piscada (`summary-block-flash`) que revela um bloco do
 * resumo, o mesmo "aqui" dito de dois lugares diferentes do produto.
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

type SearchMode = "exact" | "ask";

/** Um alvo de destaque pendente: o versículo, mais um NONCE para que pedir o
 * MESMO destaque duas vezes seguidas (duas passagens diferentes que começam
 * no mesmo número, em capítulos diferentes) ainda dispare o efeito — sem ele
 * um objeto igual ao anterior não rearmaria a espera. */
type PendingHighlight = { verse: number; nonce: number };

export function BibleReader({ className, initialBook, initialChapter }: Props) {
  const [book, setBook] = useState<string | null>(initialBook ?? null);
  const [chapter, setChapter] = useState<number | null>(
    initialBook && initialChapter ? initialChapter : null
  );
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("exact");
  const [question, setQuestion] = useState("");
  const [pendingHighlight, setPendingHighlight] = useState<PendingHighlight | null>(null);
  const bibleSearch = useBibleSearch();

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

  /** Rola até o versículo pendente e pisca nele, assim que o capítulo certo
   * termina de chegar. Ver "IR PARA A PASSAGEM" no cabeçalho do arquivo. */
  useEffect(() => {
    if (!pendingHighlight || state.status !== "ok") return;
    const { verse } = pendingHighlight;
    setPendingHighlight(null);
    const el = document.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    // Tirar, forçar o reflow e pôr de volta: é o que reinicia a animação
    // quando o mesmo elemento já a tinha, ver `reveal-block.ts`.
    el.classList.remove("summary-block-flash");
    void el.offsetWidth;
    el.classList.add("summary-block-flash");
    el.addEventListener("animationend", () => el.classList.remove("summary-block-flash"), {
      once: true,
    });
  }, [pendingHighlight, state.status]);

  function goToPassage(passage: BibleSearchPassage) {
    setBook(passage.book);
    setChapter(passage.chapter);
    const firstVerse = passage.verses[0]?.verse;
    setPendingHighlight(firstVerse ? { verse: firstVerse, nonce: Date.now() } : null);
  }

  async function copyPassage(passage: BibleSearchPassage) {
    const text = `${passage.reference}\n${joinVerses(passage.verses)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Passagem copiada");
    } catch {
      toast.error("Não consegui copiar agora");
    }
  }

  if (!book) {
    return (
      <div className={cn("flex min-h-0 flex-col gap-3", className)}>
        <SearchModeToggle mode={mode} onChange={setMode} />
        {mode === "exact" ? (
          <>
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
          </>
        ) : (
          <AskBiblo
            question={question}
            onQuestionChange={setQuestion}
            search={bibleSearch}
            onGoToPassage={goToPassage}
            onCopy={copyPassage}
          />
        )}

        <BillingDialog open={bibleSearch.billingOpen} onOpenChange={bibleSearch.setBillingOpen} />
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

/**
 * "Pesquisa Exata" contra "Perguntar ao Biblo": a mesma gramática de um
 * `Tabs` (pílula ativa invertida), com o avatar do Biblo no lugar de um ícone
 * genérico — é a "indicação do Biblo" no próprio seletor, em vez de um selo à
 * parte competindo pela mesma linha.
 */
function SearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-v2-card p-1">
      <button
        type="button"
        aria-pressed={mode === "exact"}
        onClick={() => onChange("exact")}
        className={cn(
          "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute",
          mode === "exact"
            ? "bg-v2-ink text-v2-bg"
            : "text-v2-ink-mute hover:bg-v2-card-hover hover:text-v2-ink"
        )}
      >
        Pesquisa exata
      </button>
      <button
        type="button"
        aria-pressed={mode === "ask"}
        onClick={() => onChange("ask")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute",
          mode === "ask"
            ? "bg-v2-ink text-v2-bg"
            : "text-v2-ink-mute hover:bg-v2-card-hover hover:text-v2-ink"
        )}
      >
        <BibloAvatar size={14} />
        Perguntar ao Biblo
      </button>
    </div>
  );
}

/**
 * O campo de pergunta e os resultados, quando o alternador está em "ask".
 *
 * **Sem resultado É uma resposta**, não um erro: `explanation` sozinha
 * (`passages` vazio) é a orientação do Biblo para reformular — pergunta
 * genérica demais, ou fora do território —, e a tela mostra ISSO em vez de
 * "nada encontrado" seco. Ver a regra 4 e 5 do prompt.
 */
function AskBiblo({
  question,
  onQuestionChange,
  search,
  onGoToPassage,
  onCopy,
}: {
  question: string;
  onQuestionChange: (value: string) => void;
  search: ReturnType<typeof useBibleSearch>;
  onGoToPassage: (passage: BibleSearchPassage) => void;
  onCopy: (passage: BibleSearchPassage) => void;
}) {
  const { state, ask } = search;
  const submitting = state.status === "loading";

  function submit() {
    const trimmed = question.trim();
    if (!trimmed || submitting) return;
    void ask(trimmed);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "idle" ? (
          <p className="px-1 py-6 text-center text-[13px] font-light leading-relaxed text-v2-ink-mute">
            Pergunte por um tema, uma história ou um personagem: "versículos sobre perdão", "em que
            passagem Daniel estava na cova dos leões".
          </p>
        ) : state.status === "loading" ? (
          <div
            aria-live="polite"
            className="flex flex-col items-center gap-3 px-3 py-8 text-center"
          >
            <span
              aria-hidden
              className="size-5 animate-spin rounded-full border-2 border-v2-ink-mute border-t-transparent"
            />
            <p className="text-[13px] font-light text-v2-ink-mute">
              O Biblo está analisando as escrituras…
            </p>
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="px-3 py-6 text-center text-[13px] font-light text-v2-ink-mute">
            {state.message}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {state.data.explanation ? (
              <p className="px-1 text-[13px] font-light leading-relaxed text-v2-ink-soft">
                {state.data.explanation}
              </p>
            ) : null}
            {state.data.passages.map((passage) => (
              <PassageResultCard
                key={passage.reference}
                passage={passage}
                onGoToPassage={() => onGoToPassage(passage)}
                onCopy={() => onCopy(passage)}
              />
            ))}
          </div>
        )}
      </div>

      <form
        className="relative shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={question}
          onChange={(e) =>
            onQuestionChange(e.target.value.slice(0, BIBLE_SEARCH_MAX_QUESTION_CHARS))
          }
          placeholder="Versículos sobre perdão…"
          aria-label="Perguntar ao Biblo sobre a Bíblia"
          disabled={submitting}
          className="w-full rounded-full bg-v2-card py-2.5 pr-11 pl-4 text-[13.5px] text-v2-ink placeholder:text-v2-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!question.trim() || submitting}
          aria-label="Perguntar"
          className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-v2-ink text-v2-bg transition-opacity disabled:opacity-30"
        >
          <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}

/** Um achado da busca: referência em destaque, o trecho, a nota do Biblo e as
 * duas ações diretas. */
function PassageResultCard({
  passage,
  onGoToPassage,
  onCopy,
}: {
  passage: BibleSearchPassage;
  onGoToPassage: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-v2-card p-3.5">
      <p className="text-[13.5px] font-medium text-v2-ink">{passage.reference}</p>
      <p className="line-clamp-3 text-[13px] font-light leading-relaxed text-v2-ink-soft">
        {joinVerses(passage.verses)}
      </p>
      {passage.note ? (
        <p className="text-[12px] font-light leading-relaxed text-v2-ink-mute">{passage.note}</p>
      ) : null}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onGoToPassage}
          className="inline-flex items-center gap-1.5 rounded-full bg-v2-card-hover px-3 py-1.5 text-[12px] font-medium text-v2-ink transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          Ir para a passagem
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copiar ${passage.reference}`}
          title="Copiar"
          className="inline-flex size-8 items-center justify-center rounded-full text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
        >
          <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
