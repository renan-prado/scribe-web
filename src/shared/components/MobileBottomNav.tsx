"use client";

import { BookOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom nav: 5 slots with an elevated Scriba-blue record button
 * in the center. Icons are drawn as primitive shapes to match the Claude
 * Design prototype exactly (rounded square, staggered lines, hollow circle,
 * filled dot) rather than lucide glyphs.
 */
type MobileBottomNavProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
};

export function MobileBottomNav({ avatarUrl, displayName, email }: MobileBottomNavProps = {}) {
  const pathname = usePathname() ?? "";

  const hide =
    /^\/recording\/[^/]+\/live/.test(pathname) ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/";

  if (hide) return null;

  const isFeed = pathname === "/feed";
  const isLibrary = pathname.startsWith("/list");
  const isStudies = pathname.startsWith("/studies");
  const isProfile = pathname.startsWith("/profile");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:hidden">
      <div
        aria-hidden
        className="h-24 bg-[linear-gradient(to_top,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.75)_40%,rgba(255,255,255,0.35)_75%,rgba(255,255,255,0)_100%)]"
      />
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto relative flex h-19 items-center justify-around bg-white pb-2 shadow-[0_-6px_22px_rgba(79,168,240,0.12)]"
      >
        <TabLink
          href="/feed"
          label="Feed"
          active={isFeed}
          icon={
            <span
              aria-hidden
              className={cn(
                "block size-4 rounded-[5px] border-2",
                isFeed ? "border-scriba-blue" : "border-scriba-ink-mute"
              )}
            />
          }
        />
        <TabLink
          href="/list"
          label="Gravações"
          active={isLibrary}
          icon={
            <span aria-hidden className="flex size-4 flex-col justify-between">
              <span
                className={cn(
                  "h-0.5 w-full rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-2.5 rounded-full",
                  isLibrary ? "bg-scriba-blue" : "bg-scriba-ink-mute"
                )}
              />
            </span>
          }
        />
        <span className="w-18 shrink-0" aria-hidden />
        <TabLink
          href="/studies"
          label="Estudos"
          active={isStudies}
          activeClass="text-scriba-green-ink"
          icon={
            <BookOpen
              aria-hidden
              className={cn("size-4", isStudies ? "text-scriba-green-ink" : "text-scriba-ink-mute")}
              strokeWidth={2}
            />
          }
        />
        <TabLink
          href="/profile"
          label="Perfil"
          active={isProfile}
          icon={
            <Avatar
              className={cn(
                "size-5 rounded-full ring-2",
                isProfile ? "ring-scriba-blue" : "ring-transparent"
              )}
            >
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName ?? "Perfil"} /> : null}
              <AvatarFallback className="bg-scriba-blue-soft text-[9px] font-semibold text-scriba-blue">
                {profileInitials(displayName, email)}
              </AvatarFallback>
            </Avatar>
          }
        />

        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <NewRecordingDialog
            trigger={
              <span
                className={cn(
                  "flex size-16 flex-col items-center justify-center gap-1 rounded-full bg-scriba-blue text-white",
                  "border-2 border-white shadow-[0_10px_22px_rgba(79,168,240,0.42)] transition-colors",
                  "hover:bg-scriba-blue-hover"
                )}
              >
                <span aria-hidden className="block h-[15px] w-[11px] rounded-[6px] bg-white" />
                <span className="text-[8px] font-semibold uppercase tracking-[0.05em]">Gravar</span>
              </span>
            }
          />
        </div>
      </nav>
    </div>
  );
}

type TabLinkProps = {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
  activeClass?: string;
};

function TabLink({ href, label, active, icon, activeClass = "text-scriba-blue" }: TabLinkProps) {
  return (
    <NavLink
      href={href}
      spinner="none"
      contentClassName="flex flex-col items-center gap-1.5"
      className={cn(
        "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        active ? activeClass : "text-scriba-ink-mute"
      )}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function profileInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || source.slice(0, 1).toUpperCase();
}
