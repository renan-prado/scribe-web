import { ArrowUpRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
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
      {/*
        `min-w-0` é o que permite a uma tabela larga rolar DENTRO do próprio
        cartão. Sem ele o item flex adota a largura mínima do conteúdo e é a
        PÁGINA que ganha barra horizontal — a sidebar sai da tela junto.
      */}
      <SidebarInset className="min-w-0 bg-scriba-surface">
        {/*
          A faixa é da MESMA cor do conteúdo (`--scriba-surface`), não do papel
          dos cartões: com `bg-scriba-paper` ela lia como um cartão branco
          colado no topo de uma página cinza, e a borda inferior virava a única
          coisa a separar duas superfícies que deveriam ser a mesma. O
          `backdrop-blur` continua porque ela é `sticky` e o conteúdo passa por
          baixo.
        */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b border-scriba-hairline bg-scriba-surface/85 px-3 backdrop-blur-md sm:gap-2 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {/* `data-vertical:`, e não `data-[orientation=vertical]:` — o
              Separator do base-ui emite o atributo `data-vertical`, então o
              seletor antigo nunca casava e o traço ia de topo a base da faixa. */}
          <Separator orientation="vertical" className="mx-2 hidden data-vertical:h-4 sm:block" />
          <div className="min-w-0 flex-1">
            <AdminBreadcrumbs />
          </div>
          {/*
            Voltar ao app e sair moram AQUI, e não só no menu do rodapé da
            sidebar, porque no celular a sidebar é um sheet fechado: sem estes
            dois botões, sair do admin exigia abrir a gaveta antes.
          */}
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" render={<Link href="/feed" />}>
              <ArrowUpRight />
              <span className="hidden sm:inline">Voltar ao app</span>
              <span className="sr-only sm:hidden">Voltar ao app</span>
            </Button>
            {/* Sair é um POST — o `/auth/sign-out` limpa o cookie e redireciona. */}
            <form action="/auth/sign-out" method="post" className="flex">
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sair da conta">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        {/* `<div>`, não `<main>`: o `SidebarInset` JÁ é o <main> da página.
            É `PageTransition` para o fade de troca de rota ficar DENTRO da
            moldura — sidebar e faixa do topo não podem piscar junto. */}
        <PageTransition className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          {children}
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
