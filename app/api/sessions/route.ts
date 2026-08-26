import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmptySession, SESSION_MODES } from "@/lib/db/sessions";
import { parseJsonBody } from "@/lib/http/validate";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSessionSchema = z
  .object({
    speakerName: z.string().trim().max(200).nullable().optional(),
    speakerLocation: z.string().trim().max(200).nullable().optional(),
    mode: z.enum(SESSION_MODES).optional(),
  })
  .strict();

/**
 * POST /api/sessions
 * Creates the empty row that anchors /recording/{id}/live. Called from the
 * "Nova gravação" dialog in the app header. The row
 * lives in Supabase with user_id = auth.uid() so RLS auto-scopes every
 * subsequent read/update.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS["sessions-write"], auth.user.id);
  if (limited) return limited;

  // Empty body is intentional — user may not have typed a speaker/location
  // yet. Try to parse; on any body-shape error fall back to defaults.
  const parsed = await parseJsonBody(request, CreateSessionSchema.optional());
  if (!parsed.ok) return parsed.response;
  const body = parsed.data ?? {};

  const speakerName = body.speakerName?.trim() || null;
  const speakerLocation = body.speakerLocation?.trim() || null;
  const mode = body.mode ?? "live";

  try {
    const id = await createEmptySession({ speakerName, speakerLocation, mode });
    devLog("[sessions] created", { id, mode });
    return NextResponse.json({ id, mode });
  } catch (err) {
    console.error("[sessions] create failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
