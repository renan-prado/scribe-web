"use client";

import { PenLine, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MicGlyph } from "@/components/icons/MicGlyph";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

/**
 * A barra de baixo do v2: uma faixa que escurece até o preto, com o botão de
 * CRIAR no canto direito dela.
 *
 * **Era um microfone sozinho, e por isso o menu tinha de existir.** Gravar é um
 * dos três jeitos de uma sessão nascer — os outros dois, escrever e importar do
 * YouTube, moravam na gaveta do hambúrguer, três toques longe e num lugar que
 * ninguém abre para criar, abre para navegar. Com o `+`, as três portas ficam
 * atrás do mesmo botão, que é onde o polegar já estava.
 *
 * **Ele fica à DIREITA, não mais no centro.** Centralizado, o botão pousava
 * exatamente sobre a coluna da esquerda do mural de post-its e tampava o cartão
 * de baixo; e um painel que se abre a partir do centro não tem para que lado
 * crescer. No canto, ele cresce para a ESQUERDA, na mesma linha do botão e
 * alinhado por baixo com ele — é o desenho do print, e é também o que mantém o
 * painel fora de debaixo do dedo que acabou de tocar.
 *
 * **Ela não tem fundo chapado, e é aí que está o desenho.** O que separa a
 * barra do conteúdo é um GRADIENTE (`--v2-dock-fade`), preto embaixo e
 * transparente em cima, então a lista não é cortada por uma borda, ela mergulha
 * na faixa. Isso também resolve o que a sombra do botão resolvia antes, e
 * melhor: a sombra separava o botão do que estava atrás DELE, num ponto só; a
 * faixa separa a barra inteira. Por isso o botão hoje não tem `shadow`.
 *
 * **O botão é CINZA, e de VIDRO** (`--v2-glass-*`, ver `app/globals.css`). O
 * vermelho que ele teve por um commit é a cor do microfone — do gravar, do
 * ponto que pisca durante a pregação —, e num botão que abre três portas, das
 * quais só uma grava, ele prometia a errada.
 *
 * O vidro são três camadas do mesmo material, no botão e no painel: a
 * superfície translúcida sobre `backdrop-blur`, o brilho de 10% de branco caindo
 * a 2% (que é o que dá a curvatura sob uma luz de cima) e o fio de borda. É
 * sutil de propósito — subir esses números é o caminho mais curto para o
 * plástico brilhante de 2010 —, e é o que faz o mural de post-its continuar
 * atrás da peça, desfocado, em vez de apagado por um retângulo opaco.
 *
 * **E não há véu.** O apanhador de toque atrás do painel é transparente:
 * escurecer a tela trataria como modal o que é um menu de três atalhos. A
 * Biblioteca continua legível atrás, porque ela não está bloqueada, só está
 * sendo deixada de lado por um segundo — e é justamente ela, vista pelo vidro,
 * o que dá ao painel a profundidade que um véu apagaria.
 *
 * **"Resumo mágico" leva para o `/recording` JÁ GRAVANDO**, pelo `?auto=1` da
 * URL. O parâmetro existe porque as duas portas da mesma tela querem coisas
 * diferentes: quem tocou a opção já disse que quer gravar, e pedir um segundo
 * toque do outro lado seria cobrar duas vezes pela mesma decisão; quem digita
 * `/recording` na barra de endereço (ou volta a ela pelo histórico) não pediu
 * nada, e abrir o microfone sozinho ali seria uma tela que grava sem ser
 * chamada.
 *
 * As três são `NavLink`, e não `button` com `router.push`: os destinos são
 * ROTAS, e como links eles ganham de graça o que um botão não tem, abrir em
 * nova aba, copiar endereço, o prefetch do router e o foco do teclado se
 * comportando como o resto da navegação.
 *
 * **O BOTÃO some ao rolar para baixo e volta ao rolar para cima. A FAIXA fica.**
 * Rolar para baixo é ler, e o botão é o que cobre o que se está lendo; rolar
 * para cima é procurar, e quem procura na biblioteca costuma estar a um toque
 * de gravar. O gesto é o mesmo que esconde a barra de endereço do navegador no
 * celular, então a tela responde junto.
 *
 * O gradiente NÃO acompanha, e isso é escolha: ele não é enfeite do botão, é a
 * borda de baixo da tela, o que faz a lista terminar em desvanecimento em vez
 * de em corte. Piscando junto, a tela ganharia uma moldura que aparece e some
 * sozinha, que é justamente o tipo de movimento que cansa numa lista longa.
 *
 * As duas animações do botão são assimétricas (ver `app/globals.css`): sair é
 * opacidade e rápido, voltar é mais demorado e tem zoom. O painel reaproveita a
 * MESMA entrada (`animate-v2-rec-in`), com origem no canto de baixo à direita:
 * ele cresce de dentro do botão que o abriu, em vez de aparecer pousado sobre
 * ele.
 *
 * Três detalhes que não são estética:
 *
 * - **Perto do topo ela reaparece sempre**, mesmo que o último gesto tenha
 *   sido para baixo. Sem isso, uma lista curta demais para rolar de volta
 *   deixaria o botão escondido sem nenhum jeito óbvio de trazê-lo.
 * - **Um piso de 8px por gesto.** Sem ele o repique do iOS no fim da rolagem
 *   (e o tremor do dedo parado) alterna as duas animações sozinho.
 * - **O `scroll` é `passive`.** Um listener que pode chamar `preventDefault`
 *   obriga o navegador a esperar por ele antes de pintar cada quadro da
 *   rolagem, e é exatamente isso que o dedo sente.
 *
 * **Rolar com o painel aberto FECHA o painel**, e é o mesmo listener que faz
 * isso. O painel é `fixed`: sem isso ele ficaria parado no canto enquanto a
 * lista corre atrás dele, com um véu por cima que o dedo atravessa — dois
 * comportamentos contraditórios no mesmo gesto.
 */
export function CreateDock() {
  const [visible, setVisible] = useState(true);
  // Enquanto ninguém rolou não há animação nenhuma: no carregamento da página
  // ela seria um movimento sem causa.
  const [moved, setMoved] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 8) return;
      lastY.current = y;
      setOpen(false);
      const next = y < 80 ? true : dy < 0;
      setVisible((prev) => {
        if (prev !== next) setMoved(true);
        return next;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc fecha, como qualquer coisa que abre por cima da tela. O listener só
  // existe enquanto o painel está aberto: um `keydown` global permanente para
  // um estado que quase sempre é `false` é escuta paga à toa.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Tocar fora fecha, e é só isso: o apanhador é TRANSPARENTE, não um véu.
          Escurecer a tela atrás de um painel de três atalhos trata como modal o
          que é um menu — a Biblioteca continua legível, e ela não está sendo
          bloqueada, está sendo deixada de lado por um segundo.

          Ele é um `button`, e não uma `div` com `onClick`: tocar fora para
          fechar é uma AÇÃO, e como botão ela existe também para quem navega
          por teclado e para quem usa leitor de tela. Fica ABAIXO da faixa no
          empilhamento, senão cobriria o botão que o fecha. */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar as opções de criação"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 cursor-default"
        />
      ) : null}
      {/* `pointer-events-none` na faixa inteira: ela cobre o fim da lista, e um
          gradiente que engole o toque destinado ao último cartão seria um bug
          invisível. Só o botão e o painel recebem de volta o que ela abre mão.

          A coluna de 640px é a MESMA da lista (ver `home/page.tsx`): colado na
          borda direita da janela, o botão ficaria a meia tela de distância dos
          post-its num monitor, sem nada por perto a que ele pertencesse. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-[image:var(--v2-dock-fade)] pt-32 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {/* O painel abre AO LADO do botão, na mesma linha, com os dois
            alinhados por baixo — é o desenho do print. Em cima do botão ele
            cobriria o próprio dedo que o abriu, e é por baixo que o polegar
            chega à barra.

            A conta fecha com folga em 360px, mais estreito que qualquer
            aparelho em uso: 328 de largura útil contra 258 de painel (3 × 70 de
            opção, `gap-3`, `p-3`) + 12 de respiro + 48 de botão = 318. Quem
            mexer no tamanho da opção, no padding do painel ou no do botão refaz
            esta soma: o estouro sai pela ESQUERDA da tela no celular, e não
            aparece no monitor. */}
        <div className="mx-auto flex w-full max-w-[640px] items-end justify-end gap-3 px-4">
          {open ? (
            <nav
              // `<nav>` com nome, e não `role="menu"`: ARIA menu promete
              // navegação por setas, e quem o anuncia sem implementar as setas
              // entrega ao leitor de tela um menu que não responde como menu.
              // São três LINKS para três telas — é navegação, e é assim que o
              // leitor anuncia ("Criar, navegação").
              id="create-dock-options"
              aria-label="Criar"
              className="pointer-events-auto flex origin-bottom-right animate-v2-rec-in gap-3 rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] p-3 ring-1 ring-v2-glass-edge backdrop-blur-xl"
            >
              {/* A ordem na tela é da DIREITA para a esquerda: "Resumo mágico"
                  encosta no botão, depois "Escrever", depois "Importar". O
                  painel cresce para a esquerda a partir do `+`, então o que
                  está mais perto dele é o que o dedo alcança primeiro — e o que
                  mais se faz é gravar.

                  A ordem do DOM é essa mesma, invertida, e não um
                  `flex-row-reverse`: com a linha invertida no CSS, o TAB andaria
                  ao contrário do que o olho lê, que é o tipo de descompasso que
                  só quem navega por teclado sente. */}
              <CreateOption
                href="/importar"
                icon={<YoutubeIcon className="size-5" />}
                label="Importar do YouTube"
                onNavigate={() => setOpen(false)}
              />
              {/* Escrever não custa moeda nenhuma — não há STT nem chamada de
                  modelo em lugar nenhum dele —, e por isso não leva pastilha de
                  preço que os outros dois levariam. Ver `lib/domain/session.ts`. */}
              <CreateOption
                href="/escrever"
                icon={<PenLine className="size-5" strokeWidth={1.5} />}
                label="Escrever manualmente"
                onNavigate={() => setOpen(false)}
              />
              <CreateOption
                href="/recording?auto=1"
                icon={<MicGlyph className="size-5" />}
                label="Resumo mágico"
                onNavigate={() => setOpen(false)}
              />
            </nav>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Fechar as opções de criação" : "Criar"}
            aria-expanded={open}
            aria-controls="create-dock-options"
            data-tour="create-dock"
            // Escondido ele também sai do alcance do dedo e do TAB: um botão
            // invisível que ainda recebe toque é pior que um botão visível.
            tabIndex={visible ? undefined : -1}
            aria-hidden={visible ? undefined : true}
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute",
              visible ? "pointer-events-auto" : "pointer-events-none",
              moved && (visible ? "animate-v2-rec-in" : "animate-v2-rec-out")
            )}
          >
            {/* Um `+` girado 45° É um `×`. Trocar de glifo faria o fechar
                aparecer do nada no lugar do abrir; girando, o mesmo objeto diz
                que o que ele abriu ele fecha. */}
            <Plus
              aria-hidden
              strokeWidth={1.5}
              className={cn("size-5 transition-transform duration-200", open && "rotate-45")}
            />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Uma porta de criação: ícone num quadrado e o nome embaixo, como nos prints
 * em `public/prints/new-release/`.
 *
 * A largura é FIXA, e é fixa porque os três nomes têm tamanhos muito
 * diferentes: deixados ao conteúdo, "Escrever manualmente" viraria um alvo com
 * o dobro da caixa de "Resumo mágico", e três alvos de tamanhos diferentes lado
 * a lado não leem como três opções da mesma lista.
 *
 * **O número (70px) sai da palavra mais longa**, "manualmente", que pede 65px a
 * 11px. Abaixo disso o navegador quebra a palavra no meio ou a deixa vazar. O
 * nome ocupa duas linhas quando precisa, e é por isso que ele é `leading-tight`
 * e o bloco tem altura livre.
 *
 * O toque se anuncia CLAREANDO o quadrado do ícone (`brightness`), e não
 * pintando o fundo do alvo: o quadrado é `--v2-card-hover`, a mesma cor que um
 * fundo de hover teria, e os dois juntos apagariam o quadrado exatamente no
 * momento em que o dedo está em cima dele.
 */
function CreateOption({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      href={href}
      onClick={onNavigate}
      spinner="none"
      contentClassName="flex flex-col items-center gap-2"
      className="group flex w-[70px] flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {/* Glifo de 20 num quadrado de 48: o ícone é o que a opção MOSTRA, mas o
          alvo é o quadrado inteiro, e um glifo que encosta nas bordas dele
          transforma a peça de vidro num botão de ícone apertado. */}
      <span className="flex size-12 items-center justify-center rounded-2xl bg-v2-glass-tile text-v2-ink transition group-hover:bg-v2-glass-edge">
        {icon}
      </span>
      <span className="text-center text-[11px] leading-tight font-medium text-v2-ink-soft">
        {label}
      </span>
    </NavLink>
  );
}
