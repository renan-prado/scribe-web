"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { cn } from "@/lib/utils";

/**
 * O card que ENSINA que dá para importar um vídeo do YouTube.
 *
 * ## Por que ele precisa existir
 *
 * A importação entra pela Biblioteca, num botão secundário ao lado do título,
 * de propósito, para o botão "Gravar" continuar dizendo só o que faz (ver o
 * `AGENTS.md` da raiz). O preço dessa separação é que a funcionalidade só é
 * encontrada por quem foi até `/recordings` e reparou num botão que não é o
 * principal. Quem usa o app pelo `/feed`, que é a primeira tela de toda
 * sessão de uso, pode nunca descobrir que a pregação de domingo, que já está
 * no canal da igreja, vira resumo sem gravar nada.
 *
 * Este card é a única porta de descoberta dela. Não é promoção: é a resposta a
 * "o que mais isto faz?" dada na tela em que a pessoa está olhando em volta.
 *
 * ## "Algumas poucas vezes", e o que faz ele parar
 *
 * Três exibições, espaçadas por quatro dias. Um aviso de descoberta que
 * aparece sempre deixa de ser aviso e vira mobília, a pessoa aprende a não
 * ver aquele retângulo, e o dia em que ele disser outra coisa também não será
 * lido. Três é o bastante para pegar quem só abre o app aos domingos, e pouco
 * o bastante para nunca virar paisagem.
 *
 * Quatro razões o encerram, e todas são a mesma: a pessoa já sabe.
 *
 * 1. **Já importou algum vídeo.** Decidido no SERVIDOR (`alreadyImported`), e
 *    é o sinal mais forte que existe, quem usou não precisa ser ensinado.
 *    Vindo `true`, nada é lido do `localStorage` e o componente não renderiza.
 * 2. **Clicou em importar.** Encontrou a porta; o resto é com ela.
 * 3. **Dispensou no X.** Um pedido explícito para não ver de novo.
 * 4. **Já apareceu três vezes.**
 *
 * A contagem é `localStorage`, como a soneca do `InviteFriendCard`, e degrada
 * do mesmo jeito: sem storage (janela anônima, cookies bloqueados) o card se
 * comporta como "nunca foi visto" e aparece de novo. Degradar para "aparece
 * sempre" é melhor que degradar para "nunca aparece", e o gate do servidor,
 * que é o que realmente importa, continua valendo.
 *
 * ## Ele começa ESCONDIDO
 *
 * Pelo motivo do `InviteFriendCard`: o estado só existe depois que o efeito lê
 * o `localStorage`, e renderizar visível para sumir no quadro seguinte seria um
 * card se retirando na cara de quem pediu para não vê-lo.
 */

const STORAGE_KEY = "scriba:youtube-tip";
const DAY = 24 * 60 * 60 * 1000;
/** Quantas vezes o card pode aparecer na vida de uma conta. */
const MAX_SHOWS = 3;
/** Dias de silêncio entre uma exibição e a próxima. */
const GAP_DAYS = 4;
/** Marcador de "encerrado", gravado quando a pessoa clica ou dispensa. */
const DONE = MAX_SHOWS;

type TipState = { shown: number; until: number };

function readState(): TipState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { shown: 0, until: 0 };
    const parsed = JSON.parse(raw) as Partial<TipState>;
    return {
      shown: Number.isFinite(parsed.shown) ? Number(parsed.shown) : 0,
      until: Number.isFinite(parsed.until) ? Number(parsed.until) : 0,
    };
  } catch {
    return { shown: 0, until: 0 };
  }
}

function writeState(state: TipState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sem storage não há contagem persistente. O `useState` abaixo ainda
    // esconde o card nesta visita, que é o que o clique pediu.
  }
}

export function YoutubeTipCard({
  alreadyImported,
  className,
}: {
  alreadyImported: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  // O efeito do React 19 em desenvolvimento roda duas vezes; sem esta trava a
  // primeira exibição contaria como duas e o card gastaria um terço da sua
  // vida útil no `npm run dev`.
  const counted = useRef(false);

  useEffect(() => {
    if (alreadyImported || counted.current) return;
    counted.current = true;
    const state = readState();
    if (state.shown >= MAX_SHOWS || Date.now() < state.until) return;
    // A exibição é contada AQUI, e não no clique: o que se está racionando é a
    // aparição, não a resposta a ela.
    writeState({ shown: state.shown + 1, until: Date.now() + GAP_DAYS * DAY });
    setVisible(true);
  }, [alreadyImported]);

  if (alreadyImported || !visible) return null;

  const close = () => {
    writeState({ shown: DONE, until: 0 });
    setVisible(false);
  };

  return (
    <article
      className={cn(
        "relative my-2 flex flex-col items-stretch gap-3 overflow-hidden rounded-[24px] border border-scriba-ink-strong/20 bg-scriba-cream/70 p-6 shadow-[0_2px_10px_rgba(79,168,240,0.08)] sm:flex-row sm:pl-6 sm:pr-2",
        className
      )}
    >
      {/** biome-ignore lint/performance/noImgElement: local sticker asset */}
      <img
        src="/stickers/woman/010-woman.svg"
        alt=""
        aria-hidden
        width={112}
        height={112}
        className="h-auto w-[96px] shrink-0 self-start sm:order-last sm:w-[112px] sm:self-end"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 flex-none items-center justify-center rounded-xl bg-scriba-paper text-scriba-cream-accent">
            <YoutubeIcon className="size-4" />
          </span>
          <p className="text-pretty text-[15px] font-semibold leading-snug text-scriba-ink-strong">
            Viu algo de interessante no YouTube?
          </p>
          {/* O X vive na LINHA do título, não solto no canto do card: no
              desktop o sticker ocupa a direita inteira, e um botão absoluto ali
              cairia sobre o desenho. */}
          <button
            type="button"
            onClick={close}
            aria-label="Não mostrar mais este aviso"
            className="ml-auto inline-flex size-8 flex-none items-center justify-center rounded-full text-scriba-ink-mute outline-none transition-colors hover:bg-scriba-btn-muted hover:text-scriba-ink-strong focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="text-pretty text-[13px] font-light leading-relaxed text-scriba-ink">
          Copie e cole o link do vídeo para dentro do Scriba e organizamos um resumo organizado para
          você.
        </p>
        <div className="mt-1">
          <Link
            href="/importar"
            onClick={close}
            className="scriba-cta inline-flex h-10 items-center justify-center rounded-full bg-[image:var(--scriba-cta)] px-5 text-[12px] font-semibold uppercase tracking-[.04em] text-scriba-cta-ink transition-[filter]"
          >
            Importar um vídeo
          </Link>
        </div>
      </div>
    </article>
  );
}
