"use client";

import { BarChart3, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
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
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/usage", label: "Uso & custos", icon: BarChart3 },
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
  const shownName = user.displayName?.trim() || user.email?.split("@")[0] || "Admin";
  const initials = initialsFrom(user.displayName, user.email);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Voltar para o app" render={<Link href="/feed" />}>
              {/* Mesma pena usada no AppHeader — sem quadrado, cor de tinta suave. */}
              <svg
                aria-hidden="true"
                width="26"
                height="26"
                viewBox="0 0 155 155"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 text-scriba-blue-ink"
              >
                <path d="M153.581 1.41213C152.579 0.411689 151.204 -0.079072 149.764 0.0108023C117.744 2.61952 89.9854 12.2171 67.252 28.5435C65.7797 29.6031 65.024 31.3923 65.283 33.1803C66.6973 42.8099 62.5442 54.1837 58.3911 62.6437C56.6929 57.839 54.2001 53.428 51.8172 49.8685C50.9776 48.6162 49.6082 47.8286 48.1099 47.7246C46.6045 47.6406 45.1453 48.2413 44.1507 49.3648C24.7178 71.4916 18.2847 94.7477 23.7753 122.086L1.89445 143.967C-0.631485 146.492 -0.631485 150.574 1.89445 153.099C3.15269 154.358 4.80709 154.992 6.4603 154.992C8.11352 154.992 9.76673 154.358 11.0262 153.099L66.4774 97.6473C69.0021 95.1226 73.0843 95.1226 75.6091 97.6473C78.135 100.173 78.135 104.254 75.6091 106.78L49.2653 133.124C49.7631 133.13 50.2799 133.22 50.7707 133.22C73.0772 133.22 92.9181 123.933 111.957 104.842C138.953 77.8466 151.417 48.984 154.982 5.22233C155.105 3.80799 154.588 2.41376 153.581 1.41213Z" />
              </svg>
              <span className="flex flex-col leading-tight">
                <span
                  className="text-[17px] font-semibold leading-none text-scriba-ink-strong"
                  style={{ fontFamily: "var(--font-poppins)", letterSpacing: "-0.015em" }}
                >
                  scriba
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[.14em] text-scriba-blue-ink">
                  Admin
                </span>
              </span>
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
            <SidebarMenuButton size="lg" tooltip={shownName}>
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
