import type { Metadata } from "next";
import { UsersManager } from "@/features/admin/components/UsersManager";
import { listUsers } from "@/lib/db/admin/users";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuários — Backstage" };
export const dynamic = "force-dynamic";

export default async function BackstageUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const users = await listUsers();

  return <UsersManager initialUsers={users} currentUserId={user?.id ?? ""} />;
}
