import "server-only";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("admin.users");

/**
 * Admin-side user management. All functions here assume the caller has
 * already been authorized via `requireAdmin` — they use the service-role
 * client and will happily return everyone's data.
 */

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
};

const SELECT = "id, display_name, avatar_url, email, role, is_active, created_at";

export async function listUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listUsers profiles failed: ${error.message}`);

  const lastSignIn = new Map<string, string | null>();
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) {
    log.warn("listUsers auth enrichment failed", { error: authErr.message });
  } else {
    for (const u of authData.users) {
      lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    }
  }

  return (profiles as ProfileRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: lastSignIn.get(row.id) ?? null,
  }));
}

export type UpdateUserInput = {
  displayName?: string | null;
  role?: "user" | "admin";
  isActive?: boolean;
  email?: string;
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<void> {
  const admin = createAdminClient();

  if (input.email !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(id, { email: input.email });
    if (error) throw new Error(`updateUser email failed: ${error.message}`);
  }

  const profilePatch: Record<string, unknown> = {};
  if (input.displayName !== undefined) profilePatch.display_name = input.displayName;
  if (input.role !== undefined) profilePatch.role = input.role;
  if (input.isActive !== undefined) profilePatch.is_active = input.isActive;
  if (input.email !== undefined) profilePatch.email = input.email;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", id);
    if (error) throw new Error(`updateUser profile failed: ${error.message}`);
  }
}

export async function deleteUser(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}
