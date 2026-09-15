"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronsUpDown,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mic,
  PiggyBank,
  SlidersHorizontal,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentProps, useEffect, useRef } from "react";
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
import { MENU_ITEM_CLASS } from "@/features/auth/lib/menu";
import { ScribaLogo } from "@/shared/brand";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  /**
   * As outras rotas que acendem este item. Existe para as áreas em que os
   * recortes viraram ABAS dentro da tela em vez de linhas do menu: quem está
   * em `/admin/feedback` continua dentro de "Conteúdo", e o menu precisa
   * dizer isso.
   */
  match?: string[];
};

/**
 * Oito itens, um por PERGUNTA, e nenhum por recorte.
 *
 * O menu já teve dezessete (onze mais seis num grupo "Financeiro"), e mais da
 * metade deles não era uma área: era um corte dos mesmos números. "Uso &
 * custos" e "Precificação" liam a mesma passada de `llm_usage_events`;
 * "Compromissos" era um filtro de "Lançamentos"; "Leitura da IA" era uma tela
 * com um botão; "Funcionalidades" e "Configurações financeiras" eram os dois
 * lugares de girar um parâmetro. Uma lista assim deixa de ser encontrada por
 * reconhecimento: para achar uma coluna era preciso saber de cor em qual das
 * duas telas parecidas ela estava.
 *
 * O que sobrou responde a uma pergunta cada, e os recortes viraram abas dentro
 * da tela (ver `AdminTabs`), onde eles dizem uma coisa que um item de menu não
 * diz: **isto aqui é o mesmo assunto, visto de outro ângulo.**
 *
 * O grupo do financeiro sumiu junto. Ele existia para quebrar a parede de
 * quatorze itens seguidos; com oito não há parede, e um rótulo de grupo sobre
 * uma linha só é moldura sem quadro.
 */
const NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/metricas", label: "Métricas", icon: TrendingUp },
  { href: "/admin/custos", label: "Custos", icon: BarChart3 },
  { href: "/admin/financeiro", label: "Financeiro", icon: PiggyBank },
  {
    href: "/admin/sessions",
    label: "Conteúdo",
    icon: Mic,
    match: ["/admin/sessions", "/admin/feedback"],
  },
  {
    href: "/admin/partners",
    label: "Crescimento",
    icon: Handshake,
    match: ["/admin/partners", "/admin/cupons"],
  },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/configuracoes", label: "Configurações", icon: SlidersHorizontal },
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
  // tocar no scrim, que parece cancelar o clique que se acabou de dar.
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Os itens de navegação NÃO fecham no clique; fecham quando a rota troca.
  // A diferença aparece no celular: fechando no clique, a gaveta some antes de
  // a página chegar e o toque some com ela, nenhuma tela dá sinal de que
  // alguma coisa está carregando. Fechando na TROCA, o item clicado fica à
  // vista girando o spinner do `LinkPendingSwap` pelo tempo que a rota do admin
  // (toda `force-dynamic`) levar, e a gaveta sai exatamente quando há o que
  // mostrar atrás dela. Navegação instantânea (rota já em cache) fecha no mesmo
  // quadro, como antes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: é a TROCA de rota que fecha a gaveta; `pathname` é a dependência, não o alvo da leitura
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
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
              render={<Link href="/home" />}
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
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
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
                <DropdownMenuItem
                  render={<Link href="/home" />}
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

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const { href, label, icon: Icon, exact, match } = item;
  const roots = match ?? [href];
  const active = exact
    ? pathname === href
    : roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
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
