"use client";

import { BookOpen, House, LogOut, Menu, User } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NavLink } from "@/components/NavLink";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CoinBalance } from "@/features/coins/components/CoinBalance";
import { initialsOf } from "@/features/session/lib/text";

/**
 * A gaveta do hambúrguer do v2.
 *
 * Ela abre com QUEM e QUANTO: avatar, nome e o saldo de moedas. É a mesma
 * ordem de leitura do header do app atual (avatar à direita, chip de moedas ao
 * lado), compactada numa coluna, porque no v2 o topo da tela é do título da
 * página, não do chrome.
 *
 * O saldo é o `CoinBalance` de verdade, o mesmo componente do app: ele já
 * assina a store das moedas, então um gasto feito numa aba aparece aqui sem
 * recarregar, e o toque nele abre o diálogo de compra. Um número estático
 * copiado para cá mentiria na primeira gravação.
 *
 * **Quatro destinos, e um botão de sair separado deles.** Biblioteca (o
 * `/home`, que é o acervo), Estudos, Importar do YouTube e Perfil são
 * navegação; sair não é, é o fim da sessão, e por isso mora colado no rodapé da
 * gaveta, longe do dedo que procura uma tela. Misturá-lo na mesma lista
 * deixaria o item mais perigoso do menu a um toque de distância do mais usado.
 *
 * Os quatro apontam para as telas de hoje. Os endereços antigos continuam
 * existindo, mas só para responder 308 (ver `app/AGENTS.md`).
 *
 * Sair é um `<form method="post">` para `/auth/sign-out`, o mesmo caminho do
 * `UserMenu` e do `/profile`: encerrar sessão ESCREVE (limpa o cookie), e um
 * link GET que desloga é acionado por qualquer prefetch.
 */
type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  coinBalance: number;
  /** Sem sessão não há avatar nem saldo, só a navegação. */
  hasSession: boolean;
  /**
   * Os atalhos de quem tem papel (admin, parceiro), montados no SERVIDOR e
   * entregues prontos. Slot, e não dois booleanos, pela razão do cabeçalho de
   * `PrivilegedMenuItems`: com `isAdmin &&` aqui dentro, as strings "Admin",
   * "/admin", "Área do parceiro" e "/partners" viajariam no chunk que TODO
   * usuário logado baixa. O `false` esconderia o item na tela, não o código.
   */
  privilegedItems?: ReactNode;
};

export function AppMenu({
  displayName,
  email,
  avatarUrl,
  coinBalance,
  hasSession,
  privilegedItems,
}: Props) {
  const [open, setOpen] = useState(false);
  const name = displayName?.trim() || email?.trim() || "Sua conta";

  return (
    <>
      {/* O botão fica FORA do `Sheet`, e a gaveta é controlada pelo estado: o
          `sheet.tsx` deste repositório não exporta `SheetTrigger` (ele é o
          `Dialog` do base-ui, e o trigger de lá é `display: contents`, o que
          tiraria a caixa do botão e, com ela, o alvo de toque de 44px). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-v2-ink transition-colors hover:bg-v2-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
      >
        <Menu className="size-6" strokeWidth={1.75} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* A gaveta é `--v2-card`, um degrau acima do preto da página: no
            fundo preto ela seria uma superfície invisível sobre outra, e o véu
            borrado atrás não bastaria para dizer onde ela começa. */}
        <SheetContent side="left" className="w-[300px] border-none bg-v2-card p-0 text-v2-ink">
          <SheetHeader className="gap-0 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Sua conta, seu saldo e as telas do Scriba.
            </SheetDescription>
          </SheetHeader>

          {hasSession ? (
            <div className="flex items-center gap-3 px-5 pt-6 pb-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* `<img>` cru, e não `next/image`: a foto vem do provedor de
                  login (Google), o tamanho é fixo e conhecido, e passar 40px
                  pelo otimizador é pagar uma volta no servidor para não
                  economizar nada. */}
                {avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: avatar de 40px vindo do provedor de login
                  <img
                    src={avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    referrerPolicy="no-referrer"
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-v2-card text-sm font-semibold text-v2-ink">
                    {initialsOf(displayName ?? email)}
                  </span>
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-v2-ink">{name}</span>
                  {email?.trim() && email.trim() !== name ? (
                    <span className="truncate text-xs font-light text-v2-ink-mute">{email}</span>
                  ) : null}
                </div>
              </div>
              {/* O saldo ao LADO de quem é você, não embaixo: as duas coisas
                  respondem à mesma pergunta ("de quem é esta conta, e o que ela
                  tem"), e numa linha só elas se leem juntas. */}
              <CoinBalance initialBalance={coinBalance} />
            </div>
          ) : null}

          <nav className="flex flex-col gap-1 px-3 py-2">
            <MenuItem
              href="/home"
              icon={<House className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Biblioteca
            </MenuItem>
            <MenuItem
              href="/studies"
              icon={<BookOpen className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Estudos
            </MenuItem>
            {/* A importação entra pelo MENU, e não pelo botão de gravar: aquele
                botão liga o microfone e cobra por minuto, este traz uma legenda
                que o YouTube já tem, por um preço fechado por vídeo. A
                separação é a mesma do app atual, ver `app/AGENTS.md`. */}
            <MenuItem
              href="/importar"
              icon={<YoutubeIcon className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Importar do YouTube
            </MenuItem>
            <MenuItem
              href="/profile"
              icon={<User className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Perfil
            </MenuItem>
            {/* Depois dos quatro destinos de todo mundo, e separados por uma
                linha: são portas de OUTRO produto (o painel interno, a área do
                parceiro), não mais uma tela do Scriba. */}
            {privilegedItems ? (
              <>
                <span aria-hidden className="my-1 h-px bg-v2-card" />
                {privilegedItems}
              </>
            ) : null}
          </nav>

          {hasSession ? (
            <form
              action="/auth/sign-out"
              method="post"
              className="mt-auto px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-v2-ink-mute transition-colors hover:bg-v2-card-hover hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MenuItem({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      href={href}
      onClick={onNavigate}
      spinner="none"
      contentClassName="flex items-center gap-3"
      className="rounded-xl px-3 py-3 text-sm font-medium text-v2-ink-soft transition-colors hover:bg-v2-card hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute"
    >
      {icon}
      {children}
    </NavLink>
  );
}
