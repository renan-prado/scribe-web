import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteSession, updateSessionMeta } from "@/lib/db/sessions";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    title: z.string().trim().max(200).nullable().optional(),
    speakerName: z.string().trim().max(200).nullable().optional(),
    speakerLocation: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

/**
 * PATCH /api/sessions/:id
 * Updates editable metadata: title, speakerName, speakerLocation.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  const parsed = await parseJsonBody(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  const title = parsed.data.title?.trim() || null;
  const speakerName = parsed.data.speakerName?.trim() || null;
  const speakerLocation = parsed.data.speakerLocation?.trim() || null;

  try {
    await updateSessionMeta(id, { title, speakerName, speakerLocation });
    devLog("[sessions] meta updated", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sessions] meta update failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/:id
 * Permanently removes the session and its associated data.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  const { id: rawId } = await params;
  const guarded = parseUuidParam(rawId);
  if (!guarded.ok) return guarded.response;
  const id = guarded.id;

  try {
    await deleteSession(id);
    devLog("[sessions] deleted", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sessions] delete failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
