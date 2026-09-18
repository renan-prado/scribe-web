"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeSearch } from "@/features/session/lib/search";
import { cn } from "@/lib/utils";

/**
 * A busca DENTRO de um resumo: o Ctrl+F do `/summary`.
 *
 * **A lupa desta tela procura no sermão aberto, e não no acervo.** Ela já
 * levou para a busca da Biblioteca (`LibrarySearchLink`, que é o que as outras
 * telas ainda fazem), e o defeito daquilo estava escrito no próprio código: uma
 * lupa sobre um texto longo promete procurar DENTRO dele. A saída de então foi
 * tirar o botão; a saída de agora é cumprir a promessa. Quem quer o acervo tem
 * o voltar, que é por onde entrou.
 *
 * ## Por que os destaques não são `<mark>`
 *
 * O resumo é desenhado pelo `BlockRenderer` em oito formas — parágrafo,
 * dois níveis de título, exemplo, citação, frase de destaque, menção de
 * capítulo e a citação bíblica, que ainda monta o `PassageVerses` e busca o
 * texto da NVI POR FETCH, depois da primeira pintura. Para envolver cada
 * ocorrência num `<mark>` seria preciso descer a consulta por todas elas, e
 * mesmo assim o texto dos versículos escaparia, porque ele não está nos blocos.
 *
 * Então o destaque não passa pelos renderizadores: são `Range`s sobre o DOM já
 * pintado, entregues ao registro da CSS Custom Highlight API
 * (`CSS.highlights`), que o navegador pinta por cima do texto **sem tocar na
 * árvore**. Os renderizadores não sabem que existe busca, o texto buscado
 * inclui o que chegou por fetch, e — o detalhe que fecha o desenho — como nada
 * é inserido no DOM, o `MutationObserver` abaixo não se retroalimenta. Um
 * destaque que insere `<mark>` dispara o observador que o recalcularia, e o
 * laço é infinito.
 *
 * As cores moram em `::highlight(...)`, via `<style>` injetado por ESTE
 * componente (`HIGHLIGHT_STYLE` abaixo) — não em `app/globals.css`, onde elas
 * moravam até o Turbopack parar de compilar: o Lightning CSS que ele embute
 * não reconhece `::highlight()` (vercel/next.js#85398), e um `<style>`
 * renderizado pelo React nunca passa pelo parser de CSS do bundler. A correção
 * já foi mesclada no upstream (parcel-bundler/lightningcss#970), só falta um
 * release estável do Next que a carregue — quando chegar, isto pode voltar
 * para `globals.css`. Uma pseudo-classe de destaque não é um elemento e não
 * tem `className`, e ali só valem cor, fundo, sublinhado e sombra — nada de
 * raio de canto ou respiro, então este destaque é um retângulo de tinta, e não
 * a pastilha arredondada do `<mark>` da transcrição.
 *
 * **Sem a API, a busca continua NAVEGANDO e para de PINTAR**: a conta de
 * ocorrências, o ↑↓ e a rolagem até a linha funcionam iguais, porque são
 * `Range`s, que existem em todo navegador. Só o amarelo não aparece. É o degrau
 * certo para um recurso que hoje só falta no que ninguém mais abre.
 *
 * ## O contexto existe pela mesma razão do `SearchScope`
 *
 * O BOTÃO mora na `TopBar` e o TEXTO mora na página, em ramos diferentes da
 * árvore, com um server component no meio. A diferença é onde o provider entra:
 * na Biblioteca é a página que envolve os dois, aqui é o `SavedSessionView` —
 * ele é `"use client"`, recebe a barra pronta pelo slot `header` e a renderiza
 * DENTRO de si, e contexto anda pela posição de render, não pela de criação.
 *
 * O mínimo de 2 letras não é economia de CPU: com uma letra só, "a" acende
 * quase todo o texto, e um resumo inteiro amarelo não é um resultado de busca.
 */

const HIGHLIGHT_ALL = "scriba-find";
const HIGHLIGHT_CURRENT = "scriba-find-current";
const MIN_QUERY = 2;

/**
 * O `<style>` que colore os dois destaques acima — ver o cabeçalho do arquivo
 * para o porquê de ele nascer aqui, e não em `globals.css`.
 *
 * A TINTA é `--scriba-yellow-ink`, e não `--scriba-ink-strong`: os dois
 * amarelos aqui são claros nos dois temas (eles são a cor da MOEDA, que não
 * inverte), e a tinta forte do app é quase branca no escuro — letra clara
 * sobre amarelo claro é o destaque apagando o que ele deveria mostrar.
 *
 * Duas forças: `-current` é a ocorrência em foco, a que o ↑↓ persegue, no
 * amarelo cheio; as outras ficam no claro. Sem a diferença, achar a quinta de
 * doze seria contar de cima.
 */
const HIGHLIGHT_STYLE = `
  ::highlight(${HIGHLIGHT_ALL}) {
    background-color: var(--scriba-yellow-light);
    color: var(--scriba-yellow-ink);
  }
  ::highlight(${HIGHLIGHT_CURRENT}) {
    background-color: var(--scriba-yellow);
    color: var(--scriba-yellow-ink);
  }
`;

type SummaryFindValue = {
  open: boolean;
  query: string;
  /** Quantas ocorrências o texto tem agora. */
  total: number;
  /** A ocorrência em foco, base 0. */
  index: number;
  containerRef: RefObject<HTMLDivElement | null>;
  setQuery: (value: string) => void;
  toggle: () => void;
  close: () => void;
  /** `+1` vai para a próxima, `-1` para a anterior, dando a volta nas pontas. */
  step: (delta: number) => void;
};

const SummaryFindContext = createContext<SummaryFindValue | null>(null);

export function useSummaryFind(): SummaryFindValue {
  const ctx = useContext(SummaryFindContext);
  if (!ctx) throw new Error("useSummaryFind precisa estar dentro de <SummaryFindProvider>");
  return ctx;
}

/**
 * Toda ocorrência do termo dentro do contêiner, em ordem de leitura.
 *
 * O casamento é sem acento e sem caixa, como o do acervo (`normalizeSearch`):
 * quem digita "oracao" quer achar "oração", e num teclado de celular o acento
 * é um toque a mais para um resultado que deveria ser o mesmo.
 *
 * **Isso depende de a normalização preservar o COMPRIMENTO**, porque os
 * deslocamentos achados no texto normalizado são aplicados ao `Range` sobre o
 * texto original. Ela preserva para texto precomposto, que é o que vem de um
 * modelo e de um banco: `NFD` abre "ç" em "c" + acento (2 unidades) e a
 * remoção do acento devolve 1, a mesma do "ç" de onde saiu. Para o caso raro
 * em que não bate — texto já decomposto na origem —, o nó cai no casamento
 * sem acento nenhum, que é o certo por si, em vez de recortar a letra errada.
 */
function collectRanges(root: HTMLElement, needle: string): Range[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    // **`[data-find-skip]` fica de fora, com tudo o que estiver dentro dele.**
    // É o slide da transcrição (ver `SummaryDeck`): ele está no DOM o tempo
    // todo, ao lado do resumo, mas só uma das duas metades está na tela. Contar
    // as ocorrências dele faria o "3 de 17" da barra apontar para um texto que
    // ninguém está vendo, e o ↑↓ arrastaria o trilho para o lado no meio de uma
    // busca. É a mesma regra que valia quando a transcrição era um diálogo — e
    // ela tem a busca dela, dentro do próprio slide.
    acceptNode(node) {
      return node.parentElement?.closest("[data-find-skip]")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  const found: Range[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const raw = node.nodeValue;
    if (!raw) continue;
    const normalized = normalizeSearch(raw);
    const haystack = normalized.length === raw.length ? normalized : raw.toLowerCase();
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      found.push(range);
      at = haystack.indexOf(needle, at + needle.length);
    }
  }
  return found;
}

function paint(name: string, ranges: Range[]): void {
  if (typeof CSS === "undefined" || !CSS.highlights) return;
  if (ranges.length === 0) CSS.highlights.delete(name);
  else CSS.highlights.set(name, new Highlight(...ranges));
}

export function SummaryFindProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [index, setIndex] = useState(0);

  const needle = normalizeSearch(query.trim());
  const total = ranges.length;

  // Um termo novo recomeça da primeira ocorrência: manter a quinta ao trocar
  // de palavra faria o texto saltar para um lugar que ninguém pediu.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o alvo é a troca de termo, não o valor dele
  useEffect(() => {
    setIndex(0);
  }, [needle]);

  useEffect(() => {
    const root = containerRef.current;
    if (!open || !root || needle.length < MIN_QUERY) {
      setRanges([]);
      return;
    }
    let frame = 0;
    const recompute = () => setRanges(collectRanges(root, needle));
    recompute();
    // **O texto dos versículos chega DEPOIS**, por fetch (ver `PassageVerses`),
    // e sem este observador uma busca feita antes da resposta ignoraria em
    // silêncio a metade bíblica do resumo. Ele não se retroalimenta porque
    // pintar destaque não mexe no DOM — ver o cabeçalho.
    //
    // O `requestAnimationFrame` junta a rajada de mutações de uma resposta
    // inteira num recálculo só.
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [open, needle]);

  const current = total > 0 ? Math.min(index, total - 1) : -1;

  useEffect(() => {
    paint(HIGHLIGHT_ALL, ranges);
    paint(HIGHLIGHT_CURRENT, current >= 0 ? [ranges[current]] : []);
    return () => {
      paint(HIGHLIGHT_ALL, []);
      paint(HIGHLIGHT_CURRENT, []);
    };
  }, [ranges, current]);

  // Rolar até a ocorrência em foco, UMA vez por (termo, posição). O
  // observador acima republica `ranges` a cada resposta de versículo que
  // chega, e sem esta trava a página escorregaria sozinha enquanto se lê.
  const scrolledFor = useRef("");
  useEffect(() => {
    const range = current >= 0 ? ranges[current] : null;
    if (!range) return;
    const key = `${needle}::${current}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    const anchor =
      range.startContainer.parentElement ?? (range.startContainer as HTMLElement | null);
    anchor?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [ranges, current, needle]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((prev) => {
        if (total === 0) return 0;
        return (Math.min(prev, total - 1) + delta + total) % total;
      });
    },
    [total]
  );

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) setQuery("");
      return !prev;
    });
  }, []);

  const value = useMemo<SummaryFindValue>(
    () => ({ open, query, total, index: current, containerRef, setQuery, toggle, close, step }),
    [open, query, total, current, toggle, close, step]
  );

  return (
    <SummaryFindContext.Provider value={value}>
      <style>{HIGHLIGHT_STYLE}</style>
      {children}
    </SummaryFindContext.Provider>
  );
}

/**
 * O contêiner em que se procura. Só o que estiver aqui dentro é varrido, e é
 * por isso que os diálogos do `/summary` — o alerta de alucinação, o editor de
 * título — ficam fora dele: um termo que acendesse dentro de um diálogo fechado
 * contaria ocorrências que ninguém vê.
 *
 * O que está aqui dentro e mesmo assim fica de fora é o slide da TRANSCRIÇÃO,
 * pelo `data-find-skip` (ver `collectRanges` e `SummaryDeck`): ele é irmão do
 * resumo no DOM, mas só um dos dois está na tela por vez.
 */
export function SummaryFindArea({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { containerRef } = useSummaryFind();
  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * A barra da busca, entre o cabeçalho e o texto.
 *
 * Ela só existe aberta: um campo permanente no topo de uma tela de LEITURA
 * seria um convite a procurar em quem veio ler.
 *
 * O Enter anda para a próxima ocorrência em vez de enviar nada — não há nada
 * que enviar, a busca é ao vivo —, e com Shift ele volta, que é o
 * comportamento do Ctrl+F de todo navegador. O Esc fecha, como em qualquer
 * coisa que abre por cima da tela.
 */
export function SummaryFindBar() {
  const { open, query, total, index, setQuery, close, step } = useSummaryFind();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const enough = normalizeSearch(query.trim()).length >= MIN_QUERY;

  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-scriba-ink-mute"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Procurar neste resumo"
          aria-label="Procurar neste resumo"
          className={cn(
            "w-full rounded-full border border-scriba-hairline bg-scriba-paper py-2 pr-16 pl-9 text-sm font-light text-scriba-ink outline-none transition-colors",
            "placeholder:text-scriba-ink-mute hover:border-scriba-ink-mute/40 focus:border-scriba-ink-mute/60"
          )}
        />
        {/* A conta fica DENTRO do campo, à direita, e não numa terceira peça na
            linha: ela é resposta ao que se digitou, não um controle. O
            `tabular-nums` a impede de tremer de "1 de 9" para "10 de 12". */}
        {enough ? (
          <span
            role="status"
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[11px] tabular-nums text-scriba-ink-mute"
          >
            {total === 0 ? "nada" : `${index + 1} de ${total}`}
          </span>
        ) : null}
      </div>
      <FindStep label="Ocorrência anterior" onClick={() => step(-1)} disabled={total === 0}>
        <ChevronUp className="size-4" strokeWidth={1.75} />
      </FindStep>
      <FindStep label="Próxima ocorrência" onClick={() => step(1)} disabled={total === 0}>
        <ChevronDown className="size-4" strokeWidth={1.75} />
      </FindStep>
      <FindStep label="Fechar a busca" onClick={close}>
        <X className="size-4" strokeWidth={1.75} />
      </FindStep>
    </div>
  );
}

function FindStep({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-scriba-ink-soft transition-colors hover:bg-scriba-blue-soft/70 hover:text-scriba-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
