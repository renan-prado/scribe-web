"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { SavedTranscriptView } from "@/features/session/components/SavedTranscriptView";
import { cn } from "@/lib/utils";

/**
 * O resumo e a transcrição como DOIS SLIDES da mesma tela, com os pontinhos
 * em cima.
 *
 * ## Por que a transcrição deixou de ser um diálogo
 *
 * Ela morava atrás do menu de três pontinhos, num `TranscriptDialog` (apagado
 * neste commit). Três coisas estavam erradas nisso, e a terceira é a que
 * decide:
 *
 * 1. **Ninguém achava.** O texto bruto da pregação é metade do que existe numa
 *    sessão gravada, e estava atrás de um menu que se abre para apagar e
 *    reprocessar — o lugar das ações raras.
 * 2. **Um diálogo é uma INTERRUPÇÃO**, e ler a transcrição não é uma: é a
 *    outra metade da mesma leitura. Uma gaveta por cima do resumo obriga a
 *    fechá-la para voltar, e não deixa comparar nada.
 * 3. **São dois textos sobre a mesma pregação.** Lado a lado, com um gesto
 *    entre eles, a relação entre os dois fica dita pelo desenho; num menu, ela
 *    precisa ser explicada.
 *
 * O item "Ler transcrição" saiu do menu junto: com o carrossel na tela, ele
 * seria um segundo caminho para o que está a um deslize de distância.
 *
 * ## Por que rolagem nativa, e não um `transform` com arrasto
 *
 * O trilho é um contêiner com `overflow-x` e `scroll-snap`. Isso entrega de
 * graça o que um arrasto escrito à mão custaria caro e faria pior: a inércia
 * do dedo no celular, o gesto de duas linhas do trackpad, a barra do teclado, a
 * rolagem por acessibilidade e o encaixe do sistema — cada um com a curva do
 * aparelho, não com a que a gente tivesse escolhido.
 *
 * **O preço é a ALTURA, e é o único mecanismo não óbvio deste arquivo.** Um
 * contêiner com `overflow-x` tem uma altura só para os dois slides, e os dois
 * têm alturas muito diferentes — um resumo cabe em duas telas, uma transcrição
 * de quarenta minutos cabe em quinze. Com a altura livre, o contêiner fica do
 * tamanho do MAIOR, e o resumo passa a ter dez telas de branco embaixo. Com
 * `overflow-y: auto`, aparece um segundo scroll vertical dentro da página, que
 * é a pior coisa que se pode fazer numa tela de leitura no celular.
 *
 * Então a altura é MEDIDA (um `ResizeObserver` em cada slide) e aplicada ao
 * trilho, com `overflow-y: hidden`:
 *
 * - parado, a altura é a do slide ativo — ele cabe inteiro, nada é cortado, e
 *   quem rola é a PÁGINA, como em qualquer texto longo;
 * - **em movimento, a altura vira a do MAIOR dos dois**, senão o slide que
 *   está entrando apareceria cortado na altura do que está saindo, durante todo
 *   o gesto. Ela salta para o máximo sem transição (a transição só existe na
 *   volta, ao assentar): crescer devagar embaixo do dedo é exatamente o
 *   movimento que faz o texto escorregar enquanto se arrasta.
 *
 * ## A busca do resumo não varre a transcrição
 *
 * O slide da transcrição leva `data-find-skip`, e o `SummaryFind` pula tudo o
 * que estiver dentro dele. É a mesma regra que valia quando ela era um diálogo:
 * contar ocorrências que não estão na tela faz a conta "3 de 17" apontar para
 * um texto que ninguém está vendo. A transcrição tem a busca DELA, dentro do
 * próprio slide (`SavedTranscriptView`), que filtra as linhas em vez de
 * percorrê-las.
 *
 * ## O texto só é buscado quando alguém desliza
 *
 * A transcrição nunca viajou no payload da página (ver a migração 0061 e o
 * `hasTranscript`): um sermão de quarenta minutos são dezenas de KB de texto
 * descendo pelo fio, no meio da igreja, num 3G. Ela continua sendo buscada por
 * `GET /api/sessions/:id/transcript` no instante em que o segundo slide é
 * ativado pela primeira vez — e uma vez por montagem, porque uma transcrição
 * não muda sozinha: só um reprocessamento a reescreveria, e ele recarrega a
 * página inteira.
 *
 * Enquanto ela não chegou, o slide tem a altura do aviso de carregando, e o
 * trilho cresce quando o texto entra. É a ordem certa: a página não reserva
 * quinze telas de vão por um texto que talvez ninguém peça.
 */
type Props = {
  sessionId: string;
  durationMs: number | null;
  /**
   * SE existe transcrição. Sem ela não há segundo slide, não há pontinhos, e o
   * resumo é desenhado direto, sem trilho nenhum em volta — é o caso de toda
   * sessão `manual`, escrita à mão. Um carrossel de um slide só é um carrossel
   * que promete uma coisa que não está lá.
   */
  hasTranscript: boolean;
  /** O resumo: o primeiro slide, e o que a tela mostra ao abrir. */
  children: ReactNode;
};

const PANES = [
  { id: "summary", label: "Resumo" },
  { id: "transcript", label: "Transcrição" },
] as const;

export function SummaryDeck({ sessionId, durationMs, hasTranscript, children }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  /** A altura natural de cada slide, medida. Ver o cabeçalho. */
  const [heights, setHeights] = useState<[number, number]>([0, 0]);
  /** O segundo slide já foi visitado? É o que dispara a busca do texto. */
  const [opened, setOpened] = useState(false);

  const [transcript, setTranscript] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Um observador por slide, e não um por render: a altura muda quando o texto
  // dos versículos chega (`PassageVerses`), quando a transcrição carrega e
  // quando a janela muda de largura. Um `useEffect` que medisse uma vez erraria
  // nos três casos.
  useEffect(() => {
    if (!hasTranscript) return;
    const nodes = [summaryRef.current, transcriptRef.current];
    const observer = new ResizeObserver(() => {
      setHeights([nodes[0]?.offsetHeight ?? 0, nodes[1]?.offsetHeight ?? 0]);
    });
    for (const node of nodes) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [hasTranscript]);

  useEffect(() => {
    if (!opened || transcript !== null) return;
    let alive = true;
    setFailed(false);
    fetch(`/api/sessions/${sessionId}/transcript`)
      .then((r) => (r.ok ? (r.json() as Promise<{ transcript: string }>) : Promise.reject()))
      .then((data) => {
        if (alive) setTranscript(data.transcript);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [opened, sessionId, transcript]);

  const settle = useRef<number | undefined>(undefined);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth || 1;
    const at = Math.round(track.scrollLeft / width);
    setIndex(at);
    if (at === 1) setOpened(true);
    // "Parou de mover" não tem evento próprio em navegador nenhum (o
    // `scrollend` ainda falta no Safari), então é uma pausa: 140ms sem um
    // `scroll` novo. Enquanto ela não vence, a altura é a do maior slide.
    setMoving(true);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setMoving(false), 140);
  }, []);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  const goTo = useCallback((to: number) => {
    const track = trackRef.current;
    if (!track) return;
    if (to === 1) setOpened(true);
    track.scrollTo({ left: to * track.clientWidth, behavior: "smooth" });
  }, []);

  if (!hasTranscript) return <>{children}</>;

  const height = moving ? Math.max(heights[0], heights[1]) : heights[index];

  return (
    <div className="flex flex-col gap-4">
      {/* OS PONTINHOS, em cima do texto: é o que diz que há um segundo lado
          antes de alguém descobrir por acaso. Eles são `tab`s de verdade, e não
          enfeite clicável — quem chega por teclado anda entre os dois com as
          setas, e quem usa leitor de tela ouve "Transcrição, aba 2 de 2" em vez
          de "botão". */}
      <div
        role="tablist"
        aria-label="Resumo e transcrição"
        className="flex items-center justify-center gap-2"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const to = e.key === "ArrowRight" ? 1 : 0;
          goTo(to);
          // O FOCO anda junto com a seleção. Sem isto ele ficaria no botão
          // anterior, que acabou de virar `tabIndex={-1}` — a próxima seta não
          // teria de onde sair, e um Tab devolveria o foco para o começo da
          // página.
          (e.currentTarget.children[to] as HTMLElement | undefined)?.focus();
        }}
      >
        {PANES.map((pane, i) => (
          <button
            key={pane.id}
            type="button"
            role="tab"
            id={`deck-tab-${pane.id}`}
            aria-controls={`deck-pane-${pane.id}`}
            aria-selected={index === i}
            tabIndex={index === i ? 0 : -1}
            title={pane.label}
            onClick={() => goTo(i)}
            // O alvo tem 24px de altura e o ponto tem 6: o `py-2.5` estica a
            // área de toque e o `-my-2.5` devolve o espaço ao layout, para dois
            // pontinhos não abrirem um vão de botão entre o fio e o texto.
            className="-my-2.5 group inline-flex items-center px-1 py-2.5 outline-none"
          >
            <span className="sr-only">{pane.label}</span>
            {/* O ativo é uma PASTILHA, não um ponto maior: crescer nos dois
                eixos faria os dois pularem de lugar a cada troca. Esticando só
                na horizontal, o que se lê é uma barra de progresso de duas
                casas. */}
            <span
              aria-hidden
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300",
                index === i
                  ? "w-5 bg-scriba-ink-soft"
                  : "w-1.5 bg-scriba-ink-mute/40 group-hover:bg-scriba-ink-mute"
              )}
            />
          </button>
        ))}
      </div>

      {/* O TRILHO. `overflow-y-hidden` com altura medida é o que impede um
          segundo scroll vertical dentro da página; ver o cabeçalho.
          A barra de rolagem horizontal é escondida nos dois motores: ela seria
          um fio cinza atravessando a página embaixo do resumo, e quem indica
          que há outro lado são os pontinhos. */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={height ? { height } : undefined}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // A transição só na VOLTA (ao assentar): em movimento a altura salta
          // para a do maior slide sem animação, senão ela cresceria devagar
          // embaixo do dedo enquanto se arrasta.
          !moving && "transition-[height] duration-300 ease-out"
        )}
      >
        <section
          role="tabpanel"
          id="deck-pane-summary"
          aria-labelledby="deck-tab-summary"
          className="w-full shrink-0 snap-start overflow-hidden"
        >
          <div ref={summaryRef}>{children}</div>
        </section>
        {/* `data-find-skip`: a lupa da barra procura no RESUMO, e contar aqui
            dentro apontaria "3 de 17" para um texto que não está na tela. Ver
            `SummaryFind`. */}
        <section
          role="tabpanel"
          id="deck-pane-transcript"
          aria-labelledby="deck-tab-transcript"
          data-find-skip
          className="w-full shrink-0 snap-start overflow-hidden"
        >
          <div ref={transcriptRef}>
            {transcript !== null ? (
              <SavedTranscriptView transcript={transcript} durationMs={durationMs} />
            ) : failed ? (
              <p className="py-8 text-center text-[14px] text-scriba-ink-soft">
                Não consegui carregar a transcrição. Volte ao resumo e tente de novo.
              </p>
            ) : opened ? (
              <div className="flex items-center justify-center gap-2 py-16 text-scriba-ink-soft">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                <span className="text-[14px]">Carregando a transcrição…</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
