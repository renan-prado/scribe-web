import { notFound } from "next/navigation";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RouteModal } from "@/features/admin/components/RouteModal";
import { UserEditForm } from "@/features/admin/components/UserEditForm";
import { getUserForAdmin } from "@/features/admin/server/db/users";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

/**
 * A ficha de uma conta POR CIMA da lista.
 *
 * O `(.)` intercepta `/admin/users/[id]` quando o clique parte da tabela; num
 * F5 ou num link colado quem responde é a página cheia. As duas desenham o
 * mesmo `UserEditForm`.
 *
 * **Isto é o que a ficha era ANTES, agora com endereço.** Ela já foi um
 * `<Dialog>` que um `useState` da tabela abria, o que dava o mesmo desenho e
 * nenhuma das propriedades que importam: não havia link para mandar a alguém,
 * um F5 fechava o que estava aberto, e o "voltar" do navegador saía do painel
 * em vez de fechar a ficha.
 */
export default async function AdminUserModal({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserForAdmin(id);
  if (!user) notFound();

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  return (
    <RouteModal>
      <DialogHeader>
        <DialogTitle>{user.displayName?.trim() || user.email || "Editar usuário"}</DialogTitle>
        <DialogDescription>
          Alterações são aplicadas imediatamente. Trocas de email disparam confirmação no Supabase.
        </DialogDescription>
      </DialogHeader>
      <UserEditForm user={user} currentUserId={me?.id ?? ""} frame="modal" />
    </RouteModal>
  );
}
