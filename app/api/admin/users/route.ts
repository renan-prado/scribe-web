import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listUsers } from "@/lib/db/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users] list failed", { error: (err as Error).message });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
