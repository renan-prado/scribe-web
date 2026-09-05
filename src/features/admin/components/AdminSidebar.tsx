"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronsUpDown,
  Handshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ToggleRight,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentProps, useRef } from "react";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { MENU_ITEM_CLASS } from "@/features/auth/lib/menu";
import { ScribaLogo } from "@/shared/brand";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/metricas", label: "Métricas", icon: TrendingUp },
  { href: "/admin/usage", label: "Uso & custos", icon: BarChart3 },
  { href: "/admin/precificacao", label: "Precificação", icon: Landmark },
  { href: "/admin/partners", label: "Parceiros", icon: Handshake },
  { href: "/admin/features", label: "Funcionalidades", icon: ToggleRight },
  { href: "/admin/studies", label: "Estudos", icon: ScrollText },
];

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
  // No celular a sidebar é um sheet sobre a página: sem fechá-la na navegação
  // ela fica por cima da tela que acabou de carregar, e o único jeito de sair é
  // tocar no scrim — que parece cancelar o clique que se acabou de dar.
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const shownName = user.displayName?.trim() || user.email?.split("@")[0] || "Admin";
  const initials = initialsFrom(user.displayName, user.email);
  const signOutFormRef = useRef<HTMLFormElement>(null);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Voltar para o app"
              onClick={closeOnMobile}
              render={<Link href="/feed" />}
            >
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
          <SidebarGroupLabel>Painel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      onClick={closeOnMobile}
                      render={<Link href={href} />}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
                className="min-w-[15rem] rounded-2xl border-none bg-scriba-paper p-2 shadow-[0_18px_40px_rgba(51,65,79,0.14)] ring-1 ring-scriba-hairline"
              >
                <DropdownMenuItem
                  render={<Link href="/feed" />}
                  onClick={closeOnMobile}
                  className={MENU_ITEM_CLASS}
                >
                  <ArrowUpRight className="size-4 text-scriba-ink-soft" />
                  Voltar ao app
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link href="/profile" />}
                  onClick={closeOnMobile}
                  className={MENU_ITEM_CLASS}
                >
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

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return initials || source.slice(0, 1).toUpperCase();
}
