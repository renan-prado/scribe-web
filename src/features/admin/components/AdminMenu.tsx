"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkPendingSwap } from "@/components/NavLink";
import { ADMIN_NAV, type AdminNavItem, isAdminNavActive } from "@/features/admin/lib/nav";
import { cn } from "@/lib/utils";

/**
 * O menu do painel: um botão FLUTUANTE no canto de baixo à direita que abre as
 * oito áreas em grade. É o `CreateDock` da Biblioteca com outro glifo e outro
 * conteúdo, e a semelhança é o ponto — são o mesmo gesto em dois lugares do
 * produto.
 *
 * ## O que ele substitui
 *
 * Um `SidebarTrigger` do shadcn, encostado no canto superior ESQUERDO da faixa,
 * que fazia duas coisas diferentes conforme a largura: no celular abria a
 * lateral como gaveta deslizante, no desktop recolhia e devolvia a lateral que
 * já estava na tela — um menu que "abre" o que já está aberto.
 *
 * Agora tem UMA resposta nas duas larguras, e mudou de canto junto. O canto de
 * baixo à direita é onde o polegar chega sem trocar a mão de posição; o de cima
 * à esquerda é o ponto mais distante dele numa tela de telefone, e era ali que
 * ficava o único caminho para as outras sete telas.
 *
 * **A lateral do desktop continua**, e continua sendo o mapa permanente do
 * painel: ela mostra as oito áreas sem pedir clique nenhum, que é o que uma
 * coluna de 1400px de altura pode fazer e um botão não. O menu flutuante é o
 * atalho para quem não quer arrastar o olho até lá — e no celular, onde a
 * lateral não aparece, ele é o caminho inteiro. Recolher a lateral agora é o
 * `SidebarRail` (a faixa entre ela e o conteúdo) ou o `Ctrl/⌘ + B` do shadcn.
 *
 * ## O que ele herda do `CreateDock`, e o que não
 *
 * - **Abre AO LADO do botão, na mesma linha e alinhado por baixo**, crescendo
 *   para a esquerda e para cima (`origin-bottom-right`). Em cima do botão ele
 *   ficaria debaixo do dedo que o abriu.
 * - **Não há véu.** O apanhador de toque atrás é transparente: escurecer a tela
 *   trataria como modal o que é um menu de navegação. E é a tela vista PELO
 *   vidro que dá ao painel a profundidade que um véu apagaria.
 * - **Rolar FECHA o painel.** Ele é `fixed`; parado no canto enquanto uma tabela
 *   corre atrás dele seriam dois comportamentos contraditórios no mesmo gesto.
 * - **O BOTÃO, esse, não some ao rolar.** No `CreateDock` ele se esconde na
 *   descida, porque lá rolar para baixo é LER e o botão cobre o que se está
 *   lendo. Aqui o que se rola é tabela, e o que se procura no meio dela é a
 *   próxima tela: um botão de navegação que brinca de esconde-esconde enquanto
 *   se varre uma linha custa mais do que os 56px que ele ocupa. Quem paga esses
 *   56px é a folga de baixo do `admin/layout.tsx`, para a última linha de uma
 *   tabela não morrer embaixo dele.
 * - **É `<nav>` com nome, e não `role="menu"`.** ARIA menu promete navegação por
 *   setas, e quem o anuncia sem implementar as setas entrega ao leitor de tela
 *   um menu que não responde como menu. São oito LINKS para oito telas.
 * - **O glifo NÃO gira para virar um "×".** Um `+` girado 45° é a mesma forma
 *   dizendo que fecha o que abriu; um hambúrguer girado é um hambúrguer torto.
 *   Quem diz que está aberto é o botão ACESO, e o `aria-expanded` para quem não
 *   o vê.
 */
export function AdminMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha na TROCA de rota, e não no clique. A diferença aparece no celular, e
  // é a mesma da gaveta que este painel substituiu: toda tela do admin é
  // `force-dynamic`, então o clique fica esperando o servidor — fechando no
  // clique, o painel some e nada na tela diz que algo está a caminho; fechando
  // na troca, o item clicado fica à vista girando o spinner do
  // `LinkPendingSwap` até haver o que mostrar atrás dele.
  // biome-ignore lint/correctness/useExhaustiveDependencies: é a TROCA de rota que fecha o painel; `pathname` é a dependência, não o alvo da leitura
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc fecha, e rolar também. Os dois listeners só existem enquanto o painel
  // está aberto: escuta global permanente para um estado que quase sempre é
  // `false` é trabalho pago à toa — e no `scroll` isso vale dobrado, porque ele
  // dispara a cada quadro de uma tabela longa.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    // `passive`: um listener que PODE chamar `preventDefault` obriga o navegador
    // a esperar por ele antes de pintar cada quadro da rolagem, e é exatamente
    // isso que o dedo sente.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  return (
    <>
      {/* Tocar fora fecha. É um `button`, e não uma `div` com `onClick`: fechar
          é uma AÇÃO, e como botão ela existe também para o teclado e para o
          leitor de tela. Fica ABAIXO do dock no empilhamento, senão cobriria o
          próprio botão que o fecha. */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar o menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      ) : null}
      {/* `pointer-events-none` na faixa: ela atravessa o canto inteiro da tela, e
          engolir o toque destinado à última linha de uma tabela seria um bug
          invisível. Só o botão e o painel recebem de volta o que ela abre mão.

          Sem o gradiente do `CreateDock`: lá ele é a borda de baixo da tela, o
          que faz a lista de post-its terminar em desvanecimento em vez de em
          corte. Aqui o que está embaixo é uma tabela com cabeçalho e totais, e
          um fade por cima dela apagaria justamente a linha que se foi ler. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {/* A mesma geometria do `CreateDock`: painel e botão na mesma linha,
            alinhados por baixo, o painel cedendo (`min-w-0`) e o botão nunca
            (`shrink-0`) — um painel 8px mais apertado ninguém vê, um círculo
            amassado é a primeira coisa que se vê.

            **Abaixo de 380px a linha vira COLUNA** e o painel passa a abrir em
            CIMA do botão. A grade de três colunas pede ~258px; com o gap e os
            56 do botão são 326, e numa tela de 360 com `px-5` sobram 320. Lado a
            lado ali não é apertado, é impossível, e a única saída da linha seria
            comer o painel pela esquerda. O corte é mais alto que os 349px do
            `CreateDock` porque este painel é mais largo em uma coluna de grade.

            O `max-w-[1600px]` é o mesmo teto do conteúdo do painel (ver
            `admin/layout.tsx`): colado na borda da janela, o botão ficaria longe
            da tabela num monitor largo, sem nada por perto a que pertencesse. */}
        <div className="mx-auto flex w-full max-w-[1600px] items-end justify-end gap-3 px-5 max-[379px]:flex-col lg:px-7">
          {open ? (
            <nav
              id="admin-menu-panel"
              aria-labelledby="admin-menu-title"
              className="pointer-events-auto flex min-w-0 origin-bottom-right animate-v2-rec-in flex-col rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] px-3 pt-3 pb-5 ring-1 ring-v2-glass-edge backdrop-blur-xl"
            >
              {/* O título diz o que a grade É, e dá nome ao painel para quem usa
                  leitor de tela (`aria-labelledby`, e não um `aria-label` por
                  fora repetindo a mesma frase: com os dois, a que o leitor
                  anuncia poderia divergir da que se lê sem ninguém perceber).

                  Em `--v2-ink-mute` e no mesmo corpo dos rótulos: ele é uma
                  placa, não uma opção, e mais escuro que os nomes é o que o
                  mantém atrás deles na ordem de leitura. O `pl-2` o alinha com o
                  primeiro ícone, que tem 48px de caixa para 20 de glifo. */}
              <p
                id="admin-menu-title"
                className="pt-2 pb-3 pl-2 text-[11px] leading-none font-medium text-v2-ink-mute"
              >
                Ir para:
              </p>
              {/* TRÊS colunas, e não quatro nem oito numa linha. Oito blocos de
                  70px numa linha são 616px, que não existem num telefone; em
                  três, o painel fica com a mesma largura do dock da Biblioteca e
                  as oito áreas cabem em três fileiras. A ORDEM é a da lateral,
                  que é a ordem em que as perguntas do painel se fazem — quem
                  aprendeu uma achou a outra. */}
              <div className="grid grid-cols-3 gap-2">
                {ADMIN_NAV.map((item) => (
                  <AdminMenuOption
                    key={item.href}
                    item={item}
                    active={isAdminNavActive(item, pathname)}
                  />
                ))}
              </div>
            </nav>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Fechar o menu" : "Ir para outra área"}
            aria-expanded={open}
            aria-controls="admin-menu-panel"
            // 56px, como o `+` da Biblioteca: é o único alvo flutuante da tela e
            // o caminho para as outras sete, e 48 é o MÍNIMO de um alvo de dedo,
            // não o tamanho de um botão que existe para ser achado.
            //
            // O vidro são três camadas que andam juntas — superfície translúcida
            // sobre `backdrop-blur`, o brilho de 10% de branco caindo a 2% (a
            // curvatura sob uma luz de cima) e o fio da borda. Os números são
            // baixos de propósito: subi-los é o caminho curto para o plástico
            // brilhante de 2010.
            className={cn(
              "pointer-events-auto inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-v2-glass-button bg-[image:var(--v2-glass-sheen)] text-v2-ink ring-1 ring-v2-glass-edge backdrop-blur-xl transition hover:brightness-125 active:brightness-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-ink-mute",
              open && "brightness-125"
            )}
          >
            <Menu aria-hidden className="size-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Uma área na grade: ícone num quadrado e o nome embaixo, o mesmo bloco das
 * portas de criação da Biblioteca.
 *
 * **A largura é fixa em 70px**, e é ela que garante oito alvos do MESMO
 * tamanho: ao conteúdo, "Configurações" seria quase o dobro de "Custos", e
 * blocos de larguras diferentes lado a lado não leem como itens de uma mesma
 * lista. O `break-words` com o `leading-tight` é o que faz os nomes longos
 * caberem em duas linhas em vez de vazarem.
 *
 * **O ÍCONE vira spinner enquanto a rota carrega** (`LinkPendingSwap`). Toda
 * tela do admin é `force-dynamic` — consulta ao banco, câmbio, às vezes seis
 * buscas em paralelo —, então o prefetch do `<Link>` não tem shell estático para
 * entregar e a navegação bloqueia no servidor por um segundo ou mais. Sem sinal
 * nesse intervalo o clique parece não ter acontecido, e a reação natural é
 * clicar de novo. Trocar o ícone não mexe em uma linha do layout; um indicador
 * ao lado empurraria o rótulo.
 *
 * **O item ATIVO acende o quadrado**, e não o rótulo: é o mesmo lugar em que a
 * lateral marca onde se está, e num painel que abre e fecha ele responde "vim
 * de onde?" sem que seja preciso ler os oito nomes.
 */
function AdminMenuOption({ item, active }: { item: AdminNavItem; active: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="group flex w-[70px] min-w-0 flex-col items-center gap-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {/* Glifo de 20 num quadrado de 48: o ícone é o que a opção MOSTRA, mas o
          alvo é o quadrado inteiro, e um glifo que encosta nas bordas dele
          transforma a peça de vidro num botão de ícone apertado. */}
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl transition",
          active
            ? "bg-v2-glass-edge text-scriba-ink-strong ring-1 ring-v2-glass-edge"
            : "bg-v2-glass-tile text-v2-ink group-hover:bg-v2-glass-edge"
        )}
      >
        <LinkPendingSwap>
          <Icon aria-hidden className="size-5" strokeWidth={1.5} />
        </LinkPendingSwap>
      </span>
      <span className="w-full break-words text-center text-[11px] leading-tight font-medium text-v2-ink-soft">
        {label}
      </span>
    </Link>
  );
}
