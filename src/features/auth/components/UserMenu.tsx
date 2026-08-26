"use client";

import { LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
};

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return initials || source.slice(0, 1).toUpperCase();
}

/**
 * Avatar → dropdown with an identity header and quick actions. Styled with
 * the scriba tokens (soft ring, rounded-2xl, hairline separator) so it feels
 * like a small Dialog panel rather than the base shadcn menu. The identity
 * block on top mirrors the /profile hero at a smaller scale.
 */
export function UserMenu({ displayName, email, avatarUrl, isAdmin }: Props) {
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const initials = initialsFrom(displayName, email);
  const shownName = displayName?.trim() || email?.split("@")[0] || "Sua conta";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-4 focus-visible:ring-scriba-blue/25"
          aria-label="Abrir menu do usuário"
        >
          <Avatar className="ring-2 ring-white shadow-[0_4px_12px_rgba(51,65,79,0.10)]">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={shownName} /> : null}
            <AvatarFallback className="bg-scriba-blue-soft text-scriba-blue">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="min-w-[260px] rounded-2xl border-none bg-white p-2 shadow-[0_18px_40px_rgba(51,65,79,0.14)] ring-1 ring-scriba-hairline"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 rounded-xl bg-scriba-blue-soft/60 px-3 py-3">
            <Avatar className="size-10">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={shownName} /> : null}
              <AvatarFallback className="bg-white text-scriba-blue text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-scriba-ink-strong">
                {shownName}
              </span>
              {email ? (
                <span className="truncate text-[11px] text-scriba-ink-soft">{email}</span>
              ) : null}
            </div>
          </div>

          <div className="my-1.5 h-px bg-scriba-hairline" />

          <DropdownMenuItem
            render={<Link href="/profile" />}
            className="rounded-xl px-3 py-2.5 text-[13px] font-medium text-scriba-ink-strong focus:bg-scriba-surface"
          >
            <UserIcon className="size-4 text-scriba-ink-soft" />
            Meu perfil
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem
              render={<Link href="/admin" />}
              className="rounded-xl px-3 py-2.5 text-[13px] font-medium text-scriba-ink-strong focus:bg-scriba-surface"
            >
              <LayoutDashboard className="size-4 text-scriba-ink-soft" />
              Admin
            </DropdownMenuItem>
          ) : null}

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
      <form ref={signOutFormRef} action="/auth/sign-out" method="post" className="hidden" />
    </>
  );
}
