import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Returns `{ user, response: null }` on success,
 * or `{ user: null, response: 404 }` if the current request is not from
 * an admin. 404 (not 403) is intentional — do not confirm the existence
 * of admin surface area to unauthorized callers.
 */

type AdminResult =
  | { user: { id: string; role: "admin"; isActive: boolean }; response: null }
  | { user: null; response: NextResponse };

const NOT_FOUND = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, response: NOT_FOUND() };

  const { data, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return { user: null, response: NOT_FOUND() };
  if (data.role !== "admin" || data.is_active === false) {
    return { user: null, response: NOT_FOUND() };
  }
  return { user: { id: user.id, role: "admin", isActive: true }, response: null };
}

/**
 * Server-Component variant: throws Next.js notFound() so React tree renders
 * the framework 404 page. Import from a Server Component / layout.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  return !!data && data.role === "admin" && data.is_active !== false;
}
