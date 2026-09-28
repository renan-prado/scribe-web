"use client";

import { Check } from "lucide-react";
import { useLongPress, type VerseSelection } from "@/features/session/components/VerseSelection";
import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
import type { TranslationId } from "@/lib/bibles/translations";
import { formatPassageRange } from "@/lib/domain/reference";
import type { VerseLine } from "@/lib/domain/verse";
import { cn } from "@/lib/utils";

/**
 * Uma passagem bíblica como pilha de versículos numerados (estilo app de
 * Bíblia: número sobrescrito + texto na mesma linha). Usada pelo feed ao vivo,
 * pelo resumo final e pelo estudo.
 *
 * ## Uma busca, um estado
 *
 * A versão anterior montava um componente por versículo, cada um com a sua
 * própria requisição, e revelava os versículos em ordem conforme resolviam.
 * Isso trouxe dois problemas que este arquivo existe para não repetir:
 *
 *   1. **Rate limit.** Sete chamadas para "Isaías 1:11-17"; um estudo com
 *      dezessete passagens passava de sessenta em segundos. Os versículos
 *      recusados voltavam vazios e a tela mostrava número sem texto, foi o
 *      bug reportado em produção.
 *   2. **UX de montagem.** O bloco aparecia e ia se preenchendo linha a linha,
 *      empurrando o conteúdo abaixo dele a cada versículo que chegava.
 *
 * Agora é UMA busca por passagem e um estado só: ou o esqueleto do bloco
 * inteiro, ou o texto inteiro. Nada de revelação progressiva, o ganho
 * aparente dela era efeito colateral de um problema que não existe mais.
 *
 * As linhas do esqueleto usam larguras FIXAS por posição (e não aleatórias):
 * um `Math.random()` aqui daria hidratação divergente entre servidor e
 * cliente, e o React descartaria o HTML renderizado.
 */
type PassageVersesProps = {
  bookDisplay: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  /**
   * A tradução DESTA passagem. Ausente = a de quem está lendo, que é o caso
   * de quase toda citação; ver `TranslationScope`.
   */
  translation?: TranslationId;
};

/**
 * A pilha de versículos numerados, já com o texto em mãos.
 *
 * Separada de `PassageVerses` porque o diálogo de capítulo (`ChapterDialog`)
 * mostra exatamente esta marcação a partir de uma referência SEM faixa,
 * "Jonas 1", que não cabe nas props acima. Duas cópias divergiriam na
 * primeira vez que alguém mexesse no alinhamento do `sup`.
 *
 * **`muted` é para onde o texto bíblico NÃO é o conteúdo da tela.** Na leitura
 * e no diálogo de capítulo ele é o que se veio ler, e leva a tinta cheia; na
 * prévia do `PassagePicker` ele é a conferência de uma escolha que está sendo
 * feita logo acima, e com a mesma força competia com a grade de números pela
 * atenção. `ink-mute` é o piso da escala (4,8:1 sobre o papel do diálogo, AA
 * para texto pequeno, ver `globals.css`), e o número do versículo desce junto
 * para não ficar mais forte que a frase que ele numera.
 */
export function VerseLines({
  verses,
  muted = false,
  selection,
}: {
  verses: VerseLine[];
  muted?: boolean;
  /**
   * A escolha de versículos, quando a tela tem para onde mandá-los. Ausente —
   * o resumo, o estudo, a prévia do seletor —, cada versículo continua sendo o
   * parágrafo de sempre, sem caixa, sem toque longo e com o texto selecionável
   * pelo gesto nativo. Ver `VerseSelection`.
   */
  selection?: VerseSelection;
}) {
  return (
    <div className="flex flex-col gap-1.5 pl-3">
      {verses.map((line) => (
        <VerseLineRow key={line.verse} line={line} muted={muted} selection={selection} />
      ))}
    </div>
  );
}

function VerseLineRow({
  line,
  muted,
  selection,
}: {
  line: VerseLine;
  muted: boolean;
  selection?: VerseSelection;
}) {
  const selecting = selection?.active ?? false;
  const checked = selection?.has(line.verse) ?? false;
  // O toque longo fica desarmado DENTRO do modo: ali um toque simples já
  // marca, e segurar não precisa abrir o que já está aberto.
  const longPress = useLongPress(
    () => selection?.begin(line.verse),
    Boolean(selection?.enabled) && !selecting
  );

  const body = (
    <>
      <sup
        className={cn(
          "mr-1.5 select-none align-[0.35em] text-[0.65rem] font-semibold",
          muted ? "text-scriba-ink-mute/75" : "text-muted-foreground"
        )}
      >
        {line.verse}
      </sup>
      <span>{line.text}</span>
    </>
  );

  const text = cn(
    "rounded-md text-sm leading-relaxed",
    muted ? "text-scriba-ink-mute" : "text-foreground/90"
  );

  // `data-verse` é o que o "Ir para a passagem" da busca do Biblo usa
  // para rolar até este versículo e piscar nele — ver o cabeçalho de
  // `BibleReader.tsx`. Único por CAPÍTULO visível, não por Bíblia
  // inteira: só um capítulo está montado por vez. Ele fica SEMPRE no nó de
  // fora, que é o que muda de forma quando o modo de seleção liga.
  if (!selection?.enabled) {
    return (
      <p data-verse={line.verse} className={text}>
        {body}
      </p>
    );
  }

  return (
    // `select-none` porque os dois gestos disputam o mesmo meio segundo de
    // dedo parado: com a seleção nativa de texto ligada, segurar um versículo
    // no celular levanta as alças de copiar em vez das nossas caixas.
    <div
      data-verse={line.verse}
      {...longPress}
      {...(selecting
        ? {
            role: "checkbox" as const,
            "aria-checked": checked,
            tabIndex: 0,
            onClick: () => selection.toggle(line.verse),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key !== " " && e.key !== "Enter") return;
              e.preventDefault();
              selection.toggle(line.verse);
            },
          }
        : {})}
      className={cn(
        "flex select-none items-start gap-2 rounded-md transition-colors",
        selecting && "-mx-1.5 cursor-pointer px-1.5 py-0.5",
        selecting && checked && "bg-muted"
      )}
    >
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            "mt-1 flex size-4 flex-none items-center justify-center rounded-[5px] border transition-colors",
            checked
              ? "border-transparent bg-foreground text-background"
              : "border-muted-foreground/45"
          )}
        >
          {checked ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      ) : null}
      <p className={cn(text, "min-w-0 flex-1")}>{body}</p>
    </div>
  );
}

const SKELETON_WIDTHS = ["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[95%]"];

export function PassageVerses({
  bookDisplay,
  chapter,
  startVerse,
  endVerse,
  translation,
}: PassageVersesProps) {
  const reference = formatPassageRange(bookDisplay, chapter, startVerse, endVerse);

  const state = useVerseFetch(reference, translation);

  if (state.status === "ok") return <VerseLines verses={state.verses} />;

  // Erro renderiza como ausência, e não como aviso: o cartão em volta já traz
  // a referência, e uma mensagem de falha no meio de um estudo assusta mais do
  // que informa. O rastro do problema fica no log do servidor.
  if (state.status === "error") return null;

  // O esqueleto tem a altura aproximada da passagem real, para o conteúdo
  // abaixo não pular quando o texto chega.
  const lineCount = Math.min(Math.max(endVerse - startVerse + 1, 1), 5);
  return (
    <div aria-hidden className="flex flex-col gap-2 pl-3">
      {Array.from({ length: lineCount }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas decorativas, sem identidade própria
          key={i}
          className={`block h-3 animate-skeleton-shimmer rounded-md bg-muted ${
            SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]
          }`}
        />
      ))}
    </div>
  );
}
