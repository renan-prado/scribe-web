"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A barra de "procurar dentro deste documento", FIXA no topo da tela.
 *
 * ## Por que ela é só a casca
 *
 * Duas telas procuram dentro do texto que está aberto, e o MOTOR de cada uma é
 * diferente por uma razão que não dá para contornar: na leitura o texto está
 * pintado no DOM, e o destaque são `Range`s entregues à CSS Custom Highlight
 * API (ver `SummaryFind`); no editor cada bloco é uma `textarea`, e o que está
 * dentro de uma `textarea` nenhuma dessas duas coisas alcança — lá a unidade é
 * o BLOCO, que rola até o centro e pisca (ver "A busca do editor" no
 * `Composer`).
 *
 * O que as duas TÊM igual é esta barra: campo, anterior, próxima e fechar. Copiada, ela divergiria no primeiro ajuste; com estado próprio, ela
 * teria de aprender os dois motores. Então ela não guarda nada — recebe o que
 * mostrar e devolve os gestos.
 *
 * ## Por que FIXA no topo
 *
 * Ela ficava no fluxo, entre o cabeçalho e o texto, e sumia da tela no primeiro
 * deslize: procurar é rolar até achar, e o campo com o termo, a conta de
 * resultados e o ↑↓ iam embora justamente durante o gesto que a busca existe
 * para servir. Fixa, ela cobre o cabeçalho enquanto está aberta — que é o
 * mesmo lugar de onde ela foi aberta, e o X dela é a saída.
 *
 * O `pt-[var(--safe-area-top)]` é o recorte do aparelho: no PWA instalado a
 * página passa por baixo da barra de status (`viewport-fit=cover`), e sem ele o
 * campo nasceria debaixo da hora e da bateria.
 *
 * O campo tem 16px de fonte porque abaixo disso o Safari do iPhone dá ZOOM ao
 * focar, e o app inteiro fica desalinhado até a pessoa fechar a busca.
 *
 * O Enter anda para o próximo resultado em vez de enviar nada — não há nada que
 * enviar, a busca é ao vivo —, e com Shift ele volta, que é o comportamento do
 * Ctrl+F de todo navegador. O Esc fecha, como em qualquer coisa que abre por
 * cima da tela.
 */
export function FindBar({
  query,
  total,
  index,
  label,
  onQueryChange,
  onStep,
  onClose,
}: {
  query: string;
  /** Quantos resultados o termo tem. `null` enquanto o termo é curto demais. */
  total: number | null;
  /** O resultado em foco, base 0. Nao aparece na tela: so no aviso do leitor
   *  de tela, ver o `sr-only` abaixo. */
  index: number;
  /** O que esta busca alcança ("Procurar neste resumo"). Vai para o leitor de
   *  tela; o placeholder na tela é curto, porque o campo divide a linha com
   *  três botões num telefone. */
  label: string;
  onQueryChange: (value: string) => void;
  /** `+1` vai para o próximo, `-1` para o anterior, dando a volta nas pontas. */
  onStep: (delta: number) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Quem abre a busca não quer tocar num campo em seguida. A barra só existe
  // montada (quem a chama a renderiza condicionalmente), então o foco na
  // montagem É o foco na abertura.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <search
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-v2-glass-edge border-b bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] backdrop-blur-xl",
        "pt-[var(--safe-area-top)] duration-150 animate-in fade-in-0 slide-in-from-top-2"
      )}
    >
      {/* A MESMA coluna da barra do topo (`max-w-[1024px] px-4`): a busca pousa
          exatamente sobre o cabeçalho que ela cobre, e nada anda de lugar. */}
      <div className="mx-auto flex w-full max-w-[1024px] items-center gap-2 px-4 py-2.5">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-v2-ink-mute"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            // `text`, e não `search`: o tipo `search` desenha um "x" de limpar
            // DENTRO do campo no WebKit, e ele é o terceiro botão de fechar da
            // mesma linha — o X da barra já faz esse trabalho, e num telefone
            // estreito aquele glifo comia o pouco espaço que o placeholder
            // tinha para caber.
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Enter") {
                e.preventDefault();
                onStep(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Procurar…"
            aria-label={label}
            className={cn(
              "h-11 w-full rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] pr-4 pl-10 text-[16px] text-v2-ink ring-1 ring-v2-glass-edge outline-none",
              "placeholder:text-v2-ink-mute focus-visible:ring-v2-ink-mute"
            )}
          />
          {/* A conta de resultados ("3 de 12") ficava aqui dentro, à direita, e
              saiu: num telefone estreito o campo divide a linha com três
              botões, e reservar espaço para o número deixava o próprio
              placeholder cortado pela metade. Quem diz que não há resultado são
              os ↑↓, que ficam apagados — e o resto é o texto rolando até o que
              se procurou. A conta é lida uma vez e o campo é usado o tempo
              todo.

              Ela continua EXISTINDO para quem ouve a tela: ali o texto rolando
              não é retorno nenhum, e sem a contagem a busca não responderia
              nada. */}
          {total === null ? null : (
            <span role="status" className="sr-only">
              {total === 0 ? "Nenhum resultado" : `Resultado ${index + 1} de ${total}`}
            </span>
          )}
        </div>
        {/* Os três botões andam JUNTOS (`gap-0.5`), e não espaçados como o
            resto da linha: eles são os controles da busca, e cada pixel de vão
            entre eles sai da largura do campo, que é a peça que se usa. O alvo
            de toque continua sendo o disco de 40px. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <FindStep label="Resultado anterior" onClick={() => onStep(-1)} disabled={!total}>
            <ChevronUp className="size-5" strokeWidth={1.75} />
          </FindStep>
          <FindStep label="Próximo resultado" onClick={() => onStep(1)} disabled={!total}>
            <ChevronDown className="size-5" strokeWidth={1.75} />
          </FindStep>
          <FindStep label="Fechar a busca" onClick={onClose}>
            <X className="size-5" strokeWidth={1.75} />
          </FindStep>
        </div>
      </div>
    </search>
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
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-v2-ink-soft transition-colors hover:bg-v2-card-hover hover:text-v2-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
