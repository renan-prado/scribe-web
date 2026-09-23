"use client";

import { Plus } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";
import type { BlockPick, MenuOption } from "./blocks";

/**
 * A fileira de blocos acima do teclado, no celular: o que cabe nesta linha em
 * branco, ao alcance do polegar.
 *
 * **Ela existe porque a barra `/` é um atalho de TECLADO num aparelho que não
 * tem teclado.** No computador digitar `/` é o gesto mais curto que existe; no
 * celular a mesma barra mora num teclado de terceiro nível (o `?123`, e depois
 * dele a página dos símbolos), então o único caminho para inserir um título ou
 * uma passagem custava dois toques só para achar o caractere que abre o menu.
 * O placeholder ensina o atalho, mas ensiná-lo não o torna alcançável. Aqui as
 * mesmas opções ficam à vista, e a escolha custa UM toque.
 *
 * **Só os GLIFOS, e a fileira não tem fundo: os DISCOS têm.** Com o rótulo ao
 * lado cada opção media uns 120px e três delas enchiam a largura da tela; com
 * uma pílula de vidro embrulhando todos, a fileira virava uma segunda barra do
 * app em cima do teclado. O que sobrou é uma régua de ferramentas — discos de
 * vidro soltos sobre o texto, 40px cada, o mesmo vocabulário dos botões da
 * `MobileActionBar`, sem a faixa que os agrupava. O nome não some do produto:
 * ele está no `aria-label` para quem ouve a tela, e escrito, a um toque, no
 * menu que o `+` abre.
 *
 * **Os discos da fileira não levam `backdrop-blur`, e o `+` leva.** O vidro
 * deles já é 72% opaco, então o borrão acrescenta pouco e cobra caro: são até
 * dez camadas de `backdrop-filter` lado a lado, sobre texto, num aparelho que
 * está com o teclado aberto. No `+`, que é um só e é a saída, ele fica.
 *
 * **As pontas DESVANECEM, e só do lado que ainda tem fileira.** Sem fundo, o
 * corte seco de um glifo pela metade na borda lê como defeito, e não como "há
 * mais coisa para este lado"; a máscara apaga o que está saindo e é a única
 * pista de que a fileira rola. Ela é medida (`syncEdges`), não fixa: parada no
 * começo, o primeiro glifo aparece inteiro, porque desbotar o que não tem para
 * onde rolar é desbotar um alvo por nada.
 *
 * É `mask-image`, e não uma faixa da cor do fundo por cima: a barra flutua
 * SOBRE o texto do rascunho, e um retângulo opaco nas pontas seria o único
 * pedaço sólido de uma barra que acabou de perder o fundo. A máscara apaga o
 * glifo e deixa ver o que está atrás, que é o que "desvanecer" quer dizer aqui.
 *
 * **Ela é a barra de baixo, e não uma segunda barra.** Enquanto está no ar, a
 * `MobileActionBar` (buscar, Biblo, salvar) sai — quem decide isso é o
 * `Composer`, ver "A barra de blocos" lá. Duas faixas empilhadas comeriam mais
 * de 100px sobre um teclado que já cobre metade da tela, e as três ações dela
 * não são o gesto de quem está com o cursor numa linha vazia.
 *
 * **O `+` é fixo na direita e NÃO é mais uma opção**, e por isso é o disco mais
 * claro da fileira: ele é a saída, não um bloco. Ele abre o menu da
 * barra — o mesmo `SlashMenu`, com a mesma lista, os NOMES escritos, a busca e
 * a citação rápida (`/atos 1:1`) —, que é o que responde ao glifo que ficou
 * ambíguo e ao que não coube na fileira. Fica na ponta porque a fileira ROLA, e
 * uma saída que rola para fora da tela é uma saída que some.
 *
 * **Cada glifo come o `mousedown` em vez de ouvir o `click`.** É o mesmo
 * cuidado dos itens do `SlashMenu`, pela mesma razão: o toque tiraria o foco
 * da `textarea`, e sem o foco a linha deixa de ser a linha em branco que põe
 * esta barra no ar — ela sumiria debaixo do dedo, antes de o toque virar
 * escolha. O `preventDefault` no `mousedown` segura o cursor onde está; quem
 * escolhe continua sendo o `click`, para que arrastar a fileira de lado role
 * em vez de inserir um bloco.
 */

/** O alvo de toque de cada glifo, e o do `+`: 40px, o menor disco do app.
 *  A SUPERFÍCIE não está aqui porque a do `+` é outra — ver lá embaixo. */
const BAR_BUTTON_CLASS =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute";

/** Quanto dura o apagamento em cada ponta. Menos que isto e o glifo parece
 *  cortado; mais, e a fileira perde um alvo inteiro de cada lado. */
const FADE = "28px";

export function BlockKeyboardBar({
  options,
  onPick,
  onMore,
}: {
  /** As mesmas opções do menu da barra, já peneiradas pelo `Composer`. */
  options: MenuOption[];
  onPick: (pick: BlockPick) => void;
  /** O `+`: abre o `SlashMenu` nesta linha. */
  onMore: () => void;
}) {
  useKeyboardInset();

  const rowRef = useRef<HTMLDivElement>(null);
  /** De que lado ainda há fileira fora da tela. Ver "As pontas DESVANECEM". */
  const [edges, setEdges] = useState({ start: false, end: false });

  const syncEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    // 1px de folga: a rolagem para fracionária em telas com escala, e comparar
    // com o zero cravado deixaria a ponta acesa parada no fim da fileira.
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((cur) => (cur.start === start && cur.end === end ? cur : { start, end }));
  }, []);

  // A primeira medida é antes da pintura: uma fileira que nasce com as duas
  // pontas erradas e se corrige num segundo quadro pisca no instante em que a
  // barra aparece. Depois dela, o que muda a conta é a LARGURA — girar o
  // aparelho, ou a lista encolher quando a conclusão e a ideia central saem do
  // menu (`options`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `options.length` não é lido aqui, é o GATILHO — uma opção a menos muda a largura da fileira, e a conta é sobre a largura
  useLayoutEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges, options.length]);

  const mask = `linear-gradient(to right, ${edges.start ? `transparent 0, #000 ${FADE}` : "#000 0"}, ${
    edges.end ? `#000 calc(100% - ${FADE}), transparent 100%` : "#000 100%"
  })`;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 md:hidden",
        "pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--kb-inset,0px)))]"
      )}
    >
      <div className="flex w-full max-w-[1024px] items-center gap-1.5">
        {/* `scroll-row` esconde a barra de rolagem nos dois motores: quem diz
            que há mais coisa à direita é o desvanecer da ponta. Ver o
            utilitário em `globals.css`.

            O `-webkit-` continua aqui porque o `mask-image` sem prefixo só
            entrou no Safari 15.4, e este editor atende iPhone mais velho que
            isso (ver a nota sobre lookbehind no `Composer`). */}
        <div
          ref={rowRef}
          onScroll={syncEdges}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          className="scroll-row flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
        >
          {options.map((o) => (
            <button
              key={o.type}
              type="button"
              // Ver "Cada glifo come o `mousedown`" no cabeçalho.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(o.type)}
              aria-label={o.label}
              // O nome também para quem tem ponteiro: no editor aberto num
              // tablet com mouse, o glifo sozinho é adivinhação.
              title={o.label}
              className={cn(
                BAR_BUTTON_CLASS,
                "bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink-soft ring-1 ring-v2-glass-edge"
              )}
            >
              <span aria-hidden className="flex size-5 items-center justify-center">
                {o.icon}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onMore}
          aria-label="Ver todas as opções"
          className={cn(
            BAR_BUTTON_CLASS,
            "bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl"
          )}
        >
          <Plus aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
