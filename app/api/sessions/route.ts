import { NextResponse } from "next/server";
import { createEmptySession } from "@/lib/db/sessions";
import { devLog } from "@/lib/log";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sessions
 * Creates the empty row that anchors /recording/{id}/live. Called from the
 * "Iniciar gravação" button on /spike (or straight from /home). The row
 * lives in Supabase with user_id = auth.uid() so RLS auto-scopes every
 * subsequent read/update.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  let body: {
    speakerName?: string | null;
    speakerLocation?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — user may not have typed a speaker/location yet.
  }

  const speakerName = typeof body.speakerName === "string" ? body.speakerName.trim() || null : null;
  const speakerLocation =
    typeof body.speakerLocation === "string" ? body.speakerLocation.trim() || null : null;

  try {
    const id = await createEmptySession({ speakerName, speakerLocation });
    devLog("[sessions] created", { id });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("[sessions] create failed", { error: (err as Error).message });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
