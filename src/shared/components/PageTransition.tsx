"use client";

import { usePathname } from "next/navigation";

/**
 * Re-mounts children on pathname change so `animate-content-fade` replays.
 * Uses flex-1 to inherit the body's flex column height, keeping child
 * `<main min-h-svh>` sizing intact.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-content-fade flex flex-1 flex-col">
      {children}
    </div>
  );
}
