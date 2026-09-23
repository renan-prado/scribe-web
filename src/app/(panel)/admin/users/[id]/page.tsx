import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { UserEditForm } from "@/features/admin/components/UserEditForm";
import { getUserForAdmin } from "@/features/admin/server/db/users";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserForAdmin(id).catch(() => null);
  return { title: user?.displayName?.trim() || user?.email || "Usuário" };
}

/**
 * A ficha de uma conta em PÁGINA CHEIA.
 *
 * **Esta rota não existia, e a falta dela era o defeito.** A ficha era um
 * `<Dialog>` aberto por `useState` dentro da tabela, o que significa que ela
 * não tinha endereço: não dava para mandar "olha essa conta aqui" para alguém,
 * nem voltar a ela depois de um F5. Agora o mesmo formulário tem URL, e a
 * tabela abre por cima de si mesma pelo `@modal/(.)users/[id]`.
 *
 * Quem cai AQUI é quem colou o link ou recarregou a página — ali não há
 * navegação para interceptar, e a lista atrás não existe.
 */
export default async function AdminUserPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserForAdmin(id);
  if (!user) notFound();

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/users"
        className="-mx-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-scriba-ink-mute transition-colors hover:text-scriba-ink"
      >
        <ArrowLeft className="size-3.5" />
        Todos os usuários
      </Link>

      <AdminPageHeader
        title={user.displayName?.trim() || user.email || "Usuário sem nome"}
        subtitle="Alterações são aplicadas imediatamente. Trocas de email disparam confirmação no Supabase."
      />

      <div className="admin-card-surface flex max-w-xl flex-col gap-4 p-5">
        <UserEditForm user={user} currentUserId={me?.id ?? ""} frame="page" />
      </div>
    </div>
  );
}
