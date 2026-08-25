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
              <svg
                aria-hidden="true"
                width="32"
                height="32"
                viewBox="0 0 249 249"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
                style={{ color: "#0F0D1E" }}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M179 0C217.66 0 249 31.3401 249 70V179C249 217.66 217.66 249 179 249H70C31.3401 249 5.96018e-07 217.66 0 179V70C0 31.3401 31.3401 5.95941e-07 70 0H179ZM187.439 57.0098C159.551 59.2819 135.374 67.6406 115.574 81.8604C114.292 82.7832 113.634 84.3421 113.859 85.8994C115.091 94.2864 111.474 104.192 107.856 111.561C106.377 107.376 104.206 103.534 102.131 100.434C101.4 99.3431 100.207 98.6571 98.9023 98.5664C97.5913 98.4933 96.3203 99.0167 95.4541 99.9951C78.5287 119.267 72.9249 139.522 77.707 163.333L58.6504 182.391C56.4504 184.59 56.4504 188.145 58.6504 190.344C59.7463 191.441 61.1871 191.993 62.627 191.993C64.0668 191.993 65.5067 191.441 66.6035 190.344L114.899 142.048C117.098 139.849 120.655 139.849 122.854 142.048C125.053 144.248 125.053 147.802 122.854 150.002L99.9082 172.947C100.342 172.952 100.792 173.03 101.22 173.03C120.648 173.03 137.928 164.942 154.511 148.314C178.023 124.802 188.879 99.6637 191.984 61.5488C192.091 60.317 191.641 59.1019 190.764 58.2295C189.891 57.3585 188.694 56.9315 187.439 57.0098Z"
                />
              </svg>
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold tracking-tight text-[color:var(--scriba-ink-strong)]">
                  Scriba
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[.14em] text-[color:var(--scriba-blue)]">
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
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: "#EAF4FE", color: "#4FA8F0" }}
              >
                {initials}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-semibold text-[color:var(--scriba-ink-strong)]">
                  {shownName}
                </span>
                {user.email ? (
                  <span className="truncate text-[11px] font-light text-[color:var(--scriba-ink-mute)]">
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
