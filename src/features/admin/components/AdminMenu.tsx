"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkPendingSwap } from "@/components/NavLink";
import { ADMIN_NAV, type AdminNavItem, isAdminNavActive } from "@/features/admin/lib/nav";
import { cn } from "@/lib/utils";

/**
 * O hambúrguer do painel, e o que ele abre: as oito áreas em GRADE, embaixo do
 * botão, como o `+` da Biblioteca abre as três portas de criação.
 *
 * ## O que ele substitui
 *
 * Ele era o `SidebarTrigger` do shadcn, e fazia duas coisas diferentes conforme
 * a largura: no celular abria a lateral como gaveta deslizante, no desktop
 * recolhia e devolvia a lateral que já estava na tela. Duas respostas para o
 * mesmo glifo, e a do desktop era a mais estranha das duas — um menu que
 * "abre" o que já está aberto.
 *
 * Agora o botão tem UMA resposta nas duas larguras: um painel com as áreas em
 * blocos de ícone-e-nome. No celular ele toma o lugar da gaveta (que era um
 * painel de tela inteira para oito links); no desktop ele é o atalho para quem
 * não quer arrastar o olho até a coluna da esquerda — **a lateral continua
 * ali**, e continua sendo o mapa permanente do painel. Recolhê-la agora é o
 * `SidebarRail` (a faixa entre a lateral e o conteúdo) ou o `Ctrl/⌘ + B` do
 * shadcn.
 *
 * ## Três coisas que ele herda do `CreateDock`, e uma que não
 *
 * - **O painel abre a partir do botão** (`animate-v2-rec-in` com origem no
 *   canto de cima à esquerda): ele cresce de dentro do que foi tocado, em vez
 *   de aparecer pousado sobre a tela.
 * - **Não há véu.** O apanhador de toque atrás é transparente: escurecer a tela
 *   trataria como modal o que é um menu de navegação, e o painel do admin é
 *   justamente onde se está indo, não algo que interrompe o que se lia.
 * - **É `<nav>` com nome, e não `role="menu"`.** ARIA menu promete navegação
 *   por setas, e quem o anuncia sem implementar as setas entrega ao leitor de
 *   tela um menu que não responde como menu. São oito LINKS para oito telas.
 * - **O glifo NÃO troca para um "×".** No `+` a troca é a mesma forma girando
 *   45°, o mesmo objeto dizendo que fecha o que abriu; um hambúrguer virando
 *   um × é outro desenho no lugar do primeiro, e o hambúrguer é o que a pessoa
 *   procura quando quer o menu de novo. Quem diz que está aberto é o fundo
 *   aceso do botão, e o `aria-expanded` para quem não o vê.
 */
export function AdminMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha na TROCA de rota, não no clique. A diferença aparece no celular, e é
  // a mesma da gaveta que este painel substituiu: toda tela do admin é
  // `force-dynamic`, então o clique fica esperando o servidor — fechando no
  // clique, o painel some e nada na tela diz que algo está a caminho; fechando
  // na troca, o item clicado fica à vista girando o spinner do
  // `LinkPendingSwap` até haver o que mostrar atrás dele.
  // biome-ignore lint/correctness/useExhaustiveDependencies: é a TROCA de rota que fecha o painel; `pathname` é a dependência, não o alvo da leitura
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
      {/* Tocar fora fecha. É um `button`, e não uma `div` com `onClick`: fechar
          é uma AÇÃO, e como botão ela existe também para o teclado e para o
          leitor de tela. Fica ABAIXO da faixa do topo no empilhamento (ela é
          `z-30`), senão cobriria o próprio botão que o fecha. */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar o menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 cursor-default"
        />
      ) : null}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Fechar o menu" : "Abrir o menu"}
          aria-expanded={open}
          aria-controls="admin-menu-panel"
          // 44px no celular, e não os 28px do `size="icon-sm"` do shadcn: é o
          // mínimo do WCAG 2.5.5, e este é o único caminho para as outras telas
          // no telefone. Um alvo de 28px encostado no canto superior esquerdo
          // erra na maioria dos toques de polegar. No desktop volta a 28, onde
          // o ponteiro acerta e um quadrado grande ao lado do breadcrumb
          // pesaria mais que ele.
          className={cn(
            "-ml-1 inline-flex size-11 touch-manipulation items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-7",
            open && "bg-accent"
          )}
        >
          <Menu aria-hidden className="size-5 sm:size-4" strokeWidth={2} />
        </button>

        {open ? (
          <nav
            id="admin-menu-panel"
            aria-labelledby="admin-menu-title"
            // `absolute` a partir do botão, e `w-max` com teto: a grade define
            // a largura, e o teto é o que impede as três colunas de passarem da
            // tela num celular estreito. `origin-top-left` para a animação
            // crescer do botão.
            className="absolute top-full left-0 z-40 mt-2 w-max max-w-[min(22rem,calc(100vw-2rem))] animate-v2-rec-in origin-top-left rounded-[28px] bg-v2-glass-panel bg-[image:var(--v2-glass-sheen)] px-3 pt-3 pb-5 ring-1 ring-v2-glass-edge backdrop-blur-xl"
          >
            {/* O título diz o que a grade É, e dá nome ao painel para quem usa
                leitor de tela (`aria-labelledby`, e não um `aria-label` por
                fora repetindo a mesma frase). O `pl-2` o alinha com o primeiro
                ícone, que tem caixa de 48px para um glifo de 20. */}
            <p
              id="admin-menu-title"
              className="pt-2 pb-3 pl-2 text-[11px] leading-none font-medium text-v2-ink-mute"
            >
              Ir para:
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
 * buscas em paralelo —, então o prefetch do `<Link>` não tem shell estático
 * para entregar e a navegação bloqueia no servidor por um segundo ou mais. Sem
 * sinal nesse intervalo o clique parece não ter acontecido, e a reação natural
 * é clicar de novo. Trocar o ícone não mexe em uma linha do layout; um
 * indicador ao lado empurraria o rótulo.
 *
 * **O item ATIVO acende o quadrado**, e não o rótulo: é o mesmo lugar em que a
 * lateral marca onde se está, e num painel que abre e fecha ele responde
 * "cheguei de onde?" sem que seja preciso ler os oito nomes.
 */
function AdminMenuOption({ item, active }: { item: AdminNavItem; active: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="group flex w-[70px] min-w-0 flex-col items-center gap-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
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
