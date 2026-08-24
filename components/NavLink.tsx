"use client";

import { Loader2 } from "lucide-react";
import Link, { type LinkProps, useLinkStatus } from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for `next/link` that surfaces navigation pending state on
 * the link itself: children fade to 60% and a spinner appears until the
 * destination segment's loading.tsx renders. Meant to be the default for any
 * cross-page redirect so the user always gets immediate feedback on click.
 *
 * - `spinner="inline"` (default): renders a small spinner inline after children.
 *   Best for text nav (header tabs, bottom nav labels, secondary buttons).
 * - `spinner="overlay"`: covers the link's box with a translucent blur + centered
 *   spinner. Best for card-shaped links where an inline spinner would clash
 *   with a multi-line layout.
 * - `spinner="none"`: only the opacity fade — useful when the caller wants to
 *   place a `<LinkPending />` glyph elsewhere inside the anchor.
 *
 * `contentClassName` controls the layout of the wrapping span around children.
 * Default `inline-flex items-center gap-1.5` fits most text links; pass e.g.
 * `flex flex-col gap-2` when the anchor's own layout is column.
 */
type NavLinkProps = LinkProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof LinkProps> & {
    children: ReactNode;
    contentClassName?: string;
    spinner?: "inline" | "overlay" | "none";
  };

export function NavLink({
  children,
  className,
  contentClassName,
  spinner = "inline",
  ...props
}: NavLinkProps) {
  return (
    <Link className={cn(spinner === "overlay" && "relative", className)} {...props}>
      <NavLinkContent contentClassName={contentClassName} spinner={spinner}>
        {children}
      </NavLinkContent>
    </Link>
  );
}

function NavLinkContent({
  children,
  contentClassName,
  spinner,
}: {
  children: ReactNode;
  contentClassName?: string;
  spinner: "inline" | "overlay" | "none";
}) {
  const { pending } = useLinkStatus();
  const wrapperClass = contentClassName ?? "inline-flex items-center gap-1.5";
  return (
    <>
      <span
        className={cn(wrapperClass, "transition-opacity duration-150", pending && "opacity-60")}
      >
        {children}
        {spinner === "inline" && pending ? (
          <Loader2 aria-hidden className="ml-0.5 size-3.5 shrink-0 animate-spin text-current" />
        ) : null}
      </span>
      {spinner === "overlay" && pending ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-white/40 backdrop-blur-[1px]"
        >
          <Loader2 className="size-5 animate-spin text-[color:var(--scriba-blue)]" />
        </span>
      ) : null}
    </>
  );
}

/**
 * Renders a small inline spinner while the enclosing `<Link>` is pending. Must
 * be a child of a `<Link>` (or `<NavLink>`). Useful when you don't want the
 * default NavLink wrapper — e.g. inside a custom button-shaped link.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2 aria-hidden className={cn("size-3.5 shrink-0 animate-spin text-current", className)} />
  );
}
