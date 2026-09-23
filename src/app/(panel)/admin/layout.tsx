import { ArrowUpRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminBreadcrumbs } from "@/features/admin/components/AdminBreadcrumbs";
import { AdminMenu } from "@/features/admin/components/AdminMenu";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { isCurrentUserAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" } };
export const dynamic = "force-dynamic";

/**
 * `modal` é o slot paralelo `@modal`, e ele é uma PROP porque slot de rota
 * paralela chega assim — ao lado de `children`, não dentro dele. Quem o
 * preenche são as rotas interceptadas `(.)sessions/[id]` e `(.)users/[id]`;
 * em toda outra rota do painel quem responde é `@modal/default.tsx`, com
 * `null`.
 *
 * Ele é renderizado FORA do `PageTransition` de propósito, pela mesma razão do
 * `AdminMenu`: o fade de troca de rota é do conteúdo, e um modal que nasce
 * dele apareceria desbotando por cima de uma lista que não se moveu. Como o
 * `DialogContent` monta num portal, a posição dele aqui não decide nada de
 * layout — decide só de que árvore ele faz parte.
 */
export default async function AdminLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
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
        {/*
          A altura da faixa é a do bloco MAIS o recorte do aparelho. O
          `viewport-fit=cover` do root layout manda a página passar por baixo da
          barra de status, e quem pede paga: sem o `pt`, a hora e a bateria do
          Android pousavam em cima do hambúrguer e do breadcrumb. O `<div>` do
          layout de `(app)` faz o mesmo pelas telas do app; aqui o pagamento é
          da própria faixa, porque ela é `sticky top-0` — uma folga num
          ancestral vale só enquanto a página está no topo da rolagem, e esta
          barra fica colada no alto o tempo todo. Numa aba comum de navegador o
          inset é ZERO e a conta devolve os 56px de sempre.
        */}
        <header className="sticky top-0 z-30 flex h-[calc(var(--header-height)+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b bg-background/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:gap-2 sm:px-4">
          {/* A faixa começa no BREADCRUMB, e não num botão de menu. Ela abria com
              um `SidebarTrigger` encostado no canto superior esquerdo — o ponto
              mais distante do polegar numa tela de telefone, e o único caminho
              para as outras sete telas. Ele virou o `AdminMenu`, flutuando no
              canto de baixo à direita, e o `Separator` que o dividia do
              breadcrumb foi junto: sem nada à esquerda, um traço vertical ali é
              uma marca solta. */}
          <div className="min-w-0 flex-1">
            <AdminBreadcrumbs />
          </div>
          {/*
            Voltar ao app e sair moram AQUI, e não só no menu do rodapé da
            sidebar, porque no celular a sidebar é um sheet fechado: sem estes
            dois botões, sair do admin exigia abrir a gaveta antes.
          */}
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/home" />}>
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
        {/* O ritmo do `dashboard-01`: `gap-4 pt-4` que abre para `gap-6 pt-6`
            em `md`, e `px-4 lg:px-6` na horizontal. O `max-w-[1600px]` não é
            do bloco, e fica: sem ele uma tabela de finanças se estica por um
            monitor inteiro e a linha deixa de ser lida de ponta a ponta.

            Embaixo o ritmo não vale, e por isso o `py` do bloco virou `pt`: a
            folga de baixo é a altura do botão flutuante mais o recorte do
            aparelho, senão a última linha de uma tabela para debaixo dele e não
            há rolagem que a traga inteira para a luz. É o mesmo pagamento que a
            Biblioteca faz pelo `+` do `CreateDock`, e aqui ele vale em TODA
            largura, porque o `AdminMenu` não some no desktop. */}
        <PageTransition className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:gap-6 md:pt-6 lg:px-6">
          {children}
        </PageTransition>
        {/* O slot paralelo. Ver o cabeçalho da função. */}
        {modal}
        {/* O menu do painel: as oito áreas em grade, a partir de um botão
            flutuante no canto de baixo à direita, como o `+` da Biblioteca. Ele
            mora FORA do `PageTransition` de propósito — é moldura, e piscar no
            fade de troca de rota o faria sumir justamente enquanto a tela que
            ele abriu está chegando. Ver `AdminMenu`. */}
        <AdminMenu />
      </SidebarInset>
    </SidebarProvider>
  );
}
