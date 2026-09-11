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

export const metadata: Metadata = { title: { default: "Admin", template: "%s, Admin" } };
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
    // `--header-height` como variável é o padrão do bloco `dashboard-01`: a
    // faixa do topo e o `group-has-data-[collapsible=icon]` leem o mesmo valor.
    // 14 (56px), e não os 12 (48px) do bloco, porque o `SidebarTrigger` tem
    // 44px no celular por WCAG 2.5.5 e precisa de folga em volta.
    <SidebarProvider
      style={{ "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}
    >
      <AdminSidebar
        variant="inset"
        user={{
          displayName: meta.full_name ?? meta.name ?? null,
          email: user?.email ?? null,
          avatarUrl: meta.avatar_url ?? null,
        }}
      />
      {/*
        `min-w-0` é o que permite a uma tabela larga rolar DENTRO do próprio
        cartão. Sem ele o item flex adota a largura mínima do conteúdo e é a
        PÁGINA que ganha barra horizontal, a sidebar sai da tela junto.

        A cor saiu daqui: com `variant="inset"` quem pinta o chão é o wrapper
        (`bg-sidebar`, por `has-data-[variant=inset]`), e o `SidebarInset` é o
        retângulo de canto arredondado em `bg-background` por cima dele. Era
        `bg-scriba-surface` fixo, que anulava justamente o degrau que o inset
        existe para criar.
      */}
      <SidebarInset className="min-w-0">
        {/*
          A faixa herda o chão do inset e se separa pela borda, como a
          `SiteHeader` do bloco. O `backdrop-blur` e o `sticky` continuam,
          porque aqui, ao contrário do bloco, o conteúdo passa por baixo dela.
        */}
        <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur-md sm:gap-2 sm:px-4">
          {/*
            44px no celular, e não os 28px do `size="icon-sm"` do shadcn. Este
            é o ÚNICO jeito de abrir a gaveta no telefone, a sidebar lá é um
            sheet fechado, e o `SidebarRail` (a faixa arrastável) é `sm:flex`,
            então não existe no toque. Um alvo de 28px encostado no canto
            superior esquerdo erra na maioria dos toques de polegar: falhava
            tantas vezes seguidas que parecia botão quebrado, não alvo pequeno.
            44px é o mínimo do WCAG 2.5.5 e cabe folgado nos 56px da faixa.
            No desktop volta a 28px, onde o ponteiro acerta e o peso visual de
            um quadrado grande ao lado do breadcrumb incomodaria.
          */}
          <SidebarTrigger className="-ml-1 size-11 shrink-0 touch-manipulation sm:size-7" />
          {/* `data-vertical:`, e não `data-[orientation=vertical]:`, o
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
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/feed" />}>
              <ArrowUpRight />
              <span className="hidden sm:inline">Voltar ao app</span>
              <span className="sr-only sm:hidden">Voltar ao app</span>
            </Button>
            {/* Sair é um POST, o `/auth/sign-out` limpa o cookie e redireciona. */}
            <form action="/auth/sign-out" method="post" className="flex">
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sair da conta">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        {/* `<div>`, não `<main>`: o `SidebarInset` JÁ é o <main> da página.
            É `PageTransition` para o fade de troca de rota ficar DENTRO da
            moldura, sidebar e faixa do topo não podem piscar junto. */}
        {/* O ritmo do `dashboard-01`: `gap-4 py-4` que abre para `gap-6 py-6`
            em `md`, e `px-4 lg:px-6` na horizontal. O `max-w-[1600px]` não é
            do bloco, e fica: sem ele uma tabela de finanças se estica por um
            monitor inteiro e a linha deixa de ser lida de ponta a ponta. */}
        <PageTransition className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          {children}
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
