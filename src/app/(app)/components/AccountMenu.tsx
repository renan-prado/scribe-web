"use client";

import { ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BillingDialog } from "@/features/billing/components/BillingDialog";
import { CoinBalance } from "@/features/coins/components/CoinBalance";
import { initialsOf } from "@/features/session/lib/text";
import { cn } from "@/lib/utils";
import { CoinMark } from "@/shared/icons/CoinMark";

/**
 * A conta, num menu só: quem você é, quanto você tem, e as portas que o seu
 * papel abre.
 *
 * Ele tem DOIS gatilhos e UM conteúdo, e é essa a razão de existir. O avatar
 * mora na `TopBar`, à direita da lupa; a LINHA mora no rodapé da gaveta do
 * hambúrguer, no mesmo desenho do rodapé da sidebar do `/admin`. São dois
 * lugares porque são dois caminhos: quem já está na tela toca no avatar, quem
 * abriu a gaveta para navegar encontra a conta onde ela está no painel. Duas
 * implementações é que não dá — o item mais perigoso do app (o Sair) não pode
 * ter duas versões que divergem no primeiro ajuste.
 *
 * **O saldo entrou aqui e saiu do cabeçalho da gaveta**, na mesma linha do nome,
 * que é onde ele estava lá. Ele continua sendo o `CoinBalance` de verdade
 * (assina a store das moedas, então um gasto feito numa aba aparece sem
 * recarregar), com duas diferenças:
 *
 * - `interactive={false}`. O chip que abre o `BillingDialog` sozinho seria,
 *   dentro de um menu, um diálogo montado DENTRO do popup que o próprio clique
 *   fecha, e ele se desmontaria antes de abrir. Quem abre é o item "Créditos e
 *   planos", e o diálogo mora fora do `DropdownMenu`.
 * - Ele fica no CABEÇALHO do menu, não dentro de um item. O `DropdownMenuItem`
 *   força `size-4` em todo `<svg>` sem classe de tamanho e repinta o texto dos
 *   descendentes no foco: o anel de 26px do chip virava um disco de 16px com o
 *   número fora do lugar. Um chip é um dado, não uma ação, e o lugar do dado é
 *   ao lado de quem ele descreve.
 *
 * Sair é um `<form method="post">` para `/auth/sign-out`, como no `UserMenu` e
 * no `/profile`: encerrar sessão ESCREVE (limpa o cookie), e um link GET que
 * desloga é acionado por qualquer prefetch.
 */
type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  coinBalance: number;
  /**
   * Os atalhos de quem tem papel (admin, parceiro), montados no SERVIDOR e
   * entregues prontos. Slot, e não dois booleanos, pela razão do cabeçalho de
   * `PrivilegedMenuItems`: com `isAdmin &&` aqui dentro, as strings "Admin",
   * "/admin", "Área do parceiro" e "/partners" viajariam no chunk que TODO
   * usuário logado baixa. O `false` esconderia o item na tela, não o código.
   */
  privilegedItems?: ReactNode;
  /** `avatar` na `TopBar`, `row` no rodapé da gaveta. */
  variant?: "avatar" | "row";
  /** A gaveta se fecha quando o menu leva para outra tela. */
  onNavigate?: () => void;
};

export function AccountMenu({
  displayName,
  email,
  avatarUrl,
  coinBalance,
  privilegedItems,
  variant = "avatar",
  onNavigate,
}: Props) {
  const [billingOpen, setBillingOpen] = useState(false);
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const name = displayName?.trim() || email?.trim() || "Sua conta";
  const initials = initialsOf(displayName ?? email);
  const showEmail = Boolean(email?.trim()) && email?.trim() !== name;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Conta de ${name}`}
          className={cn(
            "outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink-mute",
            // O avatar PREENCHE o botão, e o toque se anuncia CLAREANDO a
            // própria foto. Um disco de fundo atrás dela seria uma moldura que
            // só aparece no hover — invisível no celular, e um halo cinza em
            // volta de uma foto redonda no desktop. Brilho funciona nos dois
            // casos, e nas iniciais também.
            variant === "avatar"
              ? "-mr-1 inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full hover:brightness-125 active:brightness-150"
              : "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-v2-card-hover data-open:bg-v2-card-hover"
          )}
        >
          {/* 36 dentro do botão de 40, que é o tamanho do chip da lupa ao lado.
              A CAIXA dos dois é a mesma — é ela que alinha a barra —, mas uma
              foto chapada pesa mais que um disco de `--v2-card`, que é quase a
              cor da página: com os dois a 40, o avatar lia como o maior dos
              dois botões. Os 2px de folga tiram esse peso sem tirar nem o alvo
              de toque nem o centro. */}
          <Face avatarUrl={avatarUrl} initials={initials} size={variant === "avatar" ? 36 : 40} />
          {variant === "row" ? (
            <>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                {/* 15px: a linha da conta mora no rodapé da gaveta, e com os
                    destinos a 16px o nome de quem está logado não pode ser o
                    menor texto do painel. */}
                <span className="truncate text-[15px] font-semibold text-v2-ink">{name}</span>
                {showEmail ? (
                  <span className="truncate text-[13px] font-light text-v2-ink-mute">{email}</span>
                ) : null}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-v2-ink-mute" />
            </>
          ) : null}
        </DropdownMenuTrigger>

        {/* `bg-v2-card` com anel: aberto pela gaveta, o popup pousa sobre uma
            superfície da MESMA cor, e sem a borda não haveria como ver onde
            uma termina e a outra começa. O `min-w` é o que vence o
            `w-(--anchor-width)` do `dropdown-menu.tsx` — sem ele o menu do
            avatar teria a largura do avatar. */}
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-[18rem] rounded-2xl bg-v2-card p-2 text-v2-ink ring-1 ring-v2-card-hover"
        >
          {/* Quem é você e quanto você tem, na mesma linha: as duas coisas
              respondem à mesma pergunta, e era assim que a gaveta abria. */}
          <div className="flex items-center gap-3 rounded-xl bg-v2-card-hover px-3 py-3">
            <Face avatarUrl={avatarUrl} initials={initials} size={40} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-v2-ink">{name}</span>
              {showEmail ? (
                <span className="truncate text-[11px] font-light text-v2-ink-mute">{email}</span>
              ) : null}
            </div>
            <CoinBalance initialBalance={coinBalance} interactive={false} />
          </div>

          <span aria-hidden className="my-1.5 block h-px bg-v2-card-hover" />

          <DropdownMenuItem className={ACCOUNT_ITEM_CLASS} onClick={() => setBillingOpen(true)}>
            <CoinMark size={16} />
            Créditos e planos
          </DropdownMenuItem>

          <DropdownMenuItem
            render={<Link href="/profile" />}
            onClick={onNavigate}
            className={ACCOUNT_ITEM_CLASS}
          >
            <UserIcon className="size-4 text-v2-ink-mute" />
            Meu perfil
          </DropdownMenuItem>

          {privilegedItems}

          <DropdownMenuSeparator className="my-1.5 bg-v2-card-hover" />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => signOutFormRef.current?.requestSubmit()}
            className="rounded-xl px-3 py-2.5 text-[13px] font-medium"
          >
            <LogOut className="size-4" />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fora do `DropdownMenu` de propósito: o clique que o abre é o mesmo que
          fecha o menu, e um diálogo montado lá dentro sairia da árvore junto. */}
      <BillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
      <form ref={signOutFormRef} action="/auth/sign-out" method="post" className="hidden" />
    </>
  );
}

/**
 * A classe dos itens deste menu. Ela é copiada em `PrivilegedMenuItems`, e
 * precisa ser: aquele é um SERVER component, e importar uma constante de um
 * módulo `"use client"` de dentro dele não devolve a string, devolve uma
 * referência de cliente. É a mesma razão do `MENU_ITEM_CLASS` de
 * `features/auth/lib/menu.ts`, que serve ao menu claro do `/partners`.
 */
const ACCOUNT_ITEM_CLASS =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-v2-ink-soft focus:bg-v2-card-hover focus:text-v2-ink";

/**
 * A foto do provedor de login, ou as iniciais quando não há foto.
 *
 * `<img>` cru, e não `next/image`: a foto vem do Google, o tamanho é fixo e
 * conhecido, e passar 40px pelo otimizador é pagar uma volta no servidor para
 * não economizar nada.
 */
function Face({
  avatarUrl,
  initials,
  size,
}: {
  avatarUrl: string | null;
  initials: string;
  size: number;
}) {
  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: avatar pequeno vindo do provedor de login
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-v2-card-hover text-sm font-semibold text-v2-ink"
    >
      {initials}
    </span>
  );
}
