"use client";

import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";
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
export function VerseLines({ verses, muted = false }: { verses: VerseLine[]; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 pl-3">
      {verses.map((line) => (
        // `data-verse` é o que o "Ir para a passagem" da busca do Biblo usa
        // para rolar até este versículo e piscar nele — ver o cabeçalho de
        // `BibleReader.tsx`. Único por CAPÍTULO visível, não por Bíblia
        // inteira: só um capítulo está montado por vez.
        <p
          key={line.verse}
          data-verse={line.verse}
          className={cn(
            "rounded-md text-sm leading-relaxed",
            muted ? "text-scriba-ink-mute" : "text-foreground/90"
          )}
        >
          <sup
            className={cn(
              "mr-1.5 select-none align-[0.35em] text-[0.65rem] font-semibold",
              muted ? "text-scriba-ink-mute/75" : "text-muted-foreground"
            )}
          >
            {line.verse}
          </sup>
          <span>{line.text}</span>
        </p>
      ))}
    </div>
  );
}

const SKELETON_WIDTHS = ["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[95%]"];

export function PassageVerses({ bookDisplay, chapter, startVerse, endVerse }: PassageVersesProps) {
  const reference = formatPassageRange(bookDisplay, chapter, startVerse, endVerse);

  const state = useVerseFetch(reference);

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
