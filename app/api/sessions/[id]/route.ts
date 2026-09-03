import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertLocationByName } from "@/lib/db/locations";
import { deleteSession, updateSessionMeta } from "@/lib/db/sessions";
import { upsertSpeakerByName } from "@/lib/db/speakers";
import { parseJsonBody, parseUuidParam } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("sessions");

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

  const title = parsed.data.title === undefined ? undefined : parsed.data.title?.trim() || null;
  const speakerName =
    parsed.data.speakerName === undefined ? undefined : parsed.data.speakerName?.trim() || null;
  const speakerLocation =
    parsed.data.speakerLocation === undefined
      ? undefined
      : parsed.data.speakerLocation?.trim() || null;

  // Promote free-text speaker/location into per-user entities so future edits
  // can autocomplete against them. Fall through silently if entity save fails
  // — the session meta patch is what the user is waiting on.
  let speakerId: string | null | undefined;
  let locationId: string | null | undefined;
  if (speakerName !== undefined) {
    if (speakerName) {
      try {
        const s = await upsertSpeakerByName({ name: speakerName, userId: auth.user.id });
        speakerId = s.id;
      } catch (err) {
        log.error("speaker upsert failed", { error: (err as Error).message });
      }
    } else {
      speakerId = null;
    }
  }
  if (speakerLocation !== undefined) {
    if (speakerLocation) {
      try {
        const l = await upsertLocationByName({ name: speakerLocation, userId: auth.user.id });
        locationId = l.id;
      } catch (err) {
        log.error("location upsert failed", { error: (err as Error).message });
      }
    } else {
      locationId = null;
    }
  }

  try {
    await updateSessionMeta(id, {
      title,
      speakerName,
      speakerLocation,
      speakerId,
      locationId,
    });
    log.debug("meta updated", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("meta update failed", { id, error: (err as Error).message });
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
    log.debug("deleted", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("delete failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
