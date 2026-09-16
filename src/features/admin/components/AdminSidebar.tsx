"use client";

import { ArrowUpRight, ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentProps, useRef } from "react";
import { LinkPendingSwap } from "@/components/NavLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAV, type AdminNavItem, isAdminNavActive } from "@/features/admin/lib/nav";
import { MENU_ITEM_CLASS } from "@/features/auth/lib/menu";
import { ScribaLogo } from "@/shared/brand";

type AdminUser = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function AdminSidebar({
  user,
  ...props
}: ComponentProps<typeof Sidebar> & { user: AdminUser }) {
  const pathname = usePathname();
  // `isMobile` decide de que lado o menu da conta abre, e só isso. Ele já
  // guardou também o fechar da GAVETA: no celular esta lateral era um sheet, e
  // era preciso fechá-la a cada troca de rota para ela não cobrir a tela que
  // acabou de chegar. A gaveta não abre mais — quem responde pelo hambúrguer é
  // o `AdminMenu`, nas duas larguras —, então o que restou aqui é o lado do
  // dropdown.
  const { isMobile } = useSidebar();
  const shownName = user.displayName?.trim() || user.email?.split("@")[0] || "Admin";
  const initials = initialsFrom(user.displayName, user.email);
  const signOutFormRef = useRef<HTMLFormElement>(null);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Voltar para o app" render={<Link href="/home" />}>
              <ScribaLogo
                size={26}
                textClassName="text-[17px]"
                subtitle="Admin"
                className="text-scriba-ink-strong"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV.map((item) => (
                <NavRow key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    aria-label={`Conta de ${shownName}`}
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-scriba-blue-soft text-[11px] font-semibold text-scriba-blue-ink"
                >
                  {initials}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[13px] font-semibold text-scriba-ink-strong">
                    {shownName}
                  </span>
                  {user.email ? (
                    <span className="truncate text-[11px] font-light text-scriba-ink-mute">
                      {user.email}
                    </span>
                  ) : null}
                </span>
                <ChevronsUpDown className="ml-auto text-scriba-ink-mute" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
                className="min-w-[15rem] rounded-2xl border-none bg-scriba-paper p-2 shadow-[0_18px_40px_var(--scriba-shadow)] ring-1 ring-scriba-hairline"
              >
                <DropdownMenuItem render={<Link href="/home" />} className={MENU_ITEM_CLASS}>
                  <ArrowUpRight className="size-4 text-scriba-ink-soft" />
                  Voltar ao app
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/profile" />} className={MENU_ITEM_CLASS}>
                  <UserIcon className="size-4 text-scriba-ink-soft" />
                  Meu perfil
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5 bg-scriba-hairline" />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOutFormRef.current?.requestSubmit()}
                  className="rounded-xl px-3 py-2.5 text-[13px] font-medium text-scriba-rose-ink focus:bg-scriba-rose/60 focus:text-scriba-rose-ink"
                >
                  <LogOut className="size-4" />
                  Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <form ref={signOutFormRef} action="/auth/sign-out" method="post" className="hidden" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function NavRow({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const { href, label, icon: Icon } = item;
  const active = isAdminNavActive(item, pathname);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} />}>
        {/* O ÍCONE vira spinner enquanto a rota carrega.
            Toda tela do admin é `force-dynamic`, consulta ao banco, câmbio, às
            vezes seis buscas em paralelo, então o prefetch do `<Link>` não
            tem shell estático para entregar e a navegação BLOQUEIA no servidor
            por um segundo ou mais. Sem sinal nesse intervalo o clique parece
            não ter acontecido, e a reação natural é clicar de novo.

            É o mesmo `LinkPendingSwap` da barra inferior do celular, e pelo
            mesmo motivo: o ícone já existe e já ocupa o espaço, então trocá-lo
            não mexe em uma linha do layout, um indicador ao lado empurraria o
            rótulo a cada clique. Ele só responde DENTRO da árvore de um
            `<Link>`, e quem o põe lá é o `render={<Link/>}` acima. */}
        <LinkPendingSwap>
          <Icon />
        </LinkPendingSwap>
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return initials || source.slice(0, 1).toUpperCase();
}
