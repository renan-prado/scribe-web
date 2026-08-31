import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminBreadcrumbs } from "@/features/admin/components/AdminBreadcrumbs";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s — Admin" } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };

  return (
    <SidebarProvider>
      <AdminSidebar
        user={{
          displayName: meta.full_name ?? meta.name ?? null,
          email: user?.email ?? null,
          avatarUrl: meta.avatar_url ?? null,
        }}
      />
      <SidebarInset className="bg-scriba-surface">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-scriba-hairline bg-scriba-paper/85 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <AdminBreadcrumbs />
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
