import { NextResponse } from "next/server";
import { updateSessionMeta } from "@/lib/db/sessions";
import { requireAuth } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/sessions/:id
 * Updates editable metadata: title, speakerName, speakerLocation.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  let body: {
    title?: string | null;
    speakerName?: string | null;
    speakerLocation?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() || null : null;
  const speakerName = typeof body.speakerName === "string" ? body.speakerName.trim() || null : null;
  const speakerLocation =
    typeof body.speakerLocation === "string" ? body.speakerLocation.trim() || null : null;

  try {
    await updateSessionMeta(id, { title, speakerName, speakerLocation });
    console.log("[sessions] meta updated", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sessions] meta update failed", { id, error: (err as Error).message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
