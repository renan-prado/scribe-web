import type { Metadata } from "next";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { UsersManager } from "@/features/admin/components/UsersManager";
import { listUsers } from "@/lib/db/admin/users";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Usuários"
        subtitle="Convide, promova ou desative membros da plataforma."
      />
      <UsersManager initialUsers={users} currentUserId={user?.id ?? ""} />
    </div>
  );
}
