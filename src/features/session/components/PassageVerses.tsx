"use client";

import { useVerseFetch } from "@/features/session/hooks/useVerseFetch";

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
 *      recusados voltavam vazios e a tela mostrava número sem texto — foi o
 *      bug reportado em produção.
 *   2. **UX de montagem.** O bloco aparecia e ia se preenchendo linha a linha,
 *      empurrando o conteúdo abaixo dele a cada versículo que chegava.
 *
 * Agora é UMA busca por passagem e um estado só: ou o esqueleto do bloco
 * inteiro, ou o texto inteiro. Nada de revelação progressiva — o ganho
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

const SKELETON_WIDTHS = ["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[95%]"];

export function PassageVerses({ bookDisplay, chapter, startVerse, endVerse }: PassageVersesProps) {
  const reference =
    endVerse > startVerse
      ? `${bookDisplay} ${chapter}:${startVerse}-${endVerse}`
      : `${bookDisplay} ${chapter}:${startVerse}`;

  const state = useVerseFetch(reference);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-1.5 pl-3">
        {state.verses.map((line) => (
          <p key={line.verse} className="text-sm leading-relaxed text-foreground/90">
            <sup className="mr-1.5 select-none align-[0.35em] text-[0.65rem] font-semibold text-muted-foreground">
              {line.verse}
            </sup>
            <span>{line.text}</span>
          </p>
        ))}
      </div>
    );
  }

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
