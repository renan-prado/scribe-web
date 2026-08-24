"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { NewRecordingDialog } from "@/features/session/components/NewRecordingDialog";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom nav: 5 slots with an elevated Scriba-blue record button
 * in the center. Icons are drawn as primitive shapes to match the Claude
 * Design prototype exactly (rounded square, staggered lines, hollow circle,
 * filled dot) rather than lucide glyphs.
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? "";

  const hide =
    /^\/recording\/[^/]+\/live/.test(pathname) ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/";

  if (hide) return null;

  const isFeed = pathname === "/feed";
  const isLibrary = pathname.startsWith("/list");
  const isProfile = pathname.startsWith("/profile");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:hidden">
      <div aria-hidden className="h-16 bg-[linear-gradient(to_top,#FFFFFF,rgba(255,255,255,0))]" />
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto relative flex h-[76px] items-center justify-around bg-white pb-2 shadow-[0_-6px_22px_rgba(79,168,240,0.12)]"
      >
        <TabLink
          href="/feed"
          label="Feed"
          active={isFeed}
          icon={
            <span
              aria-hidden
              className={cn(
                "block size-4 rounded-[5px] border-[2px]",
                isFeed
                  ? "border-[color:var(--scriba-blue)]"
                  : "border-[color:var(--scriba-ink-mute)]"
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
                  isLibrary ? "bg-[color:var(--scriba-blue)]" : "bg-[color:var(--scriba-ink-mute)]"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full rounded-full",
                  isLibrary ? "bg-[color:var(--scriba-blue)]" : "bg-[color:var(--scriba-ink-mute)]"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-[10px] rounded-full",
                  isLibrary ? "bg-[color:var(--scriba-blue)]" : "bg-[color:var(--scriba-ink-mute)]"
                )}
              />
            </span>
          }
        />
        <span className="w-[72px] shrink-0" aria-hidden />
        <TabButton
          label="Buscar"
          disabled
          icon={
            <span
              aria-hidden
              className="block size-[15px] rounded-full border-[2px] border-[color:var(--scriba-ink-mute)]"
            />
          }
        />
        <TabLink
          href="/profile"
          label="Perfil"
          active={isProfile}
          icon={
            <span
              aria-hidden
              className={cn(
                "block size-4 rounded-full",
                isProfile ? "bg-[color:var(--scriba-blue)]" : "bg-[color:#DCE4EC]"
              )}
            />
          }
        />

        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <NewRecordingDialog
            trigger={
              <span
                className={cn(
                  "flex size-16 flex-col items-center justify-center gap-1 rounded-full bg-[color:var(--scriba-blue)] text-white",
                  "border-[5px] border-white shadow-[0_10px_22px_rgba(79,168,240,0.42)] transition-colors",
                  "hover:bg-[color:var(--scriba-blue-hover)] cursor-pointer"
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

function TabLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <NavLink
      href={href}
      spinner="none"
      contentClassName="flex flex-col items-center gap-1.5"
      className={cn(
        "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        active ? "text-[color:var(--scriba-blue)]" : "text-[color:var(--scriba-ink-mute)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function TabButton({
  label,
  icon,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-[color:var(--scriba-ink-mute)] transition-colors",
        disabled && "cursor-default"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
