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

export function UserMenu({ displayName, email, avatarUrl, isAdmin }: Props) {
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const initials = initialsFrom(displayName, email);
  const shownName = displayName?.trim() || email?.split("@")[0] || "Sua conta";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/40"
          aria-label="Abrir menu do usuário"
        >
          <Avatar>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={shownName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-52">
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{shownName}</span>
            {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserIcon />
            Meu perfil
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem render={<Link href="/backstage" />}>
              <LayoutDashboard />
              Backstage
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => signOutFormRef.current?.requestSubmit()}
          >
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form ref={signOutFormRef} action="/auth/sign-out" method="post" className="hidden" />
    </>
  );
}
