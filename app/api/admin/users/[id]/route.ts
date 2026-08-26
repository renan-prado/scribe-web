import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { deleteUser, updateUser } from "@/lib/db/admin/users";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    role: z.enum(["user", "admin"]).optional(),
    isActive: z.boolean().optional(),
    email: z.string().email().max(320).optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  // Guardrail: admin cannot demote or deactivate themselves — prevents
  // locking the last admin out of the platform.
  if (id === auth.user.id) {
    if (parsed.data.role === "user") {
      return NextResponse.json({ error: "cannot_self_demote" }, { status: 400 });
    }
    if (parsed.data.isActive === false) {
      return NextResponse.json({ error: "cannot_self_deactivate" }, { status: 400 });
    }
  }

  try {
    await updateUser(id, parsed.data);
    devLog("[admin/users] updated", { id, fields: Object.keys(parsed.data) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users] update failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.admin, auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  if (id === auth.user.id) {
    return NextResponse.json({ error: "cannot_self_delete" }, { status: 400 });
  }

  try {
    await deleteUser(id);
    devLog("[admin/users] deleted", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users] delete failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
