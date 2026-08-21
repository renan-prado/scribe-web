import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackstageNav } from "@/features/admin/components/BackstageNav";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function BackstageLayout({ children }: { children: ReactNode }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          Backstage
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Painel administrativo</h1>
      </div>
      <BackstageNav />
      <div>{children}</div>
    </div>
  );
}
