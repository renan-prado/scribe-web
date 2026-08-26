import { NextResponse } from "next/server";
import { loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/feed";
import { devLog } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

export type { VersePayload } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSLATION = "NVI";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.verse, auth.user.id);
  if (limited) return limited;

  let body: { reference?: string };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const reference = (body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ error: "empty reference" }, { status: 400 });
  }

  const parsed = parseVerseReference(reference);
  if (!parsed || parsed.startVerse == null || parsed.endVerse == null) {
    return NextResponse.json({ reference, text: "" });
  }

  const bible = await loadBible(TRANSLATION);
  if (!bible) {
    devLog("[verse] miss", { reference, reason: "translation-file-missing" });
    return NextResponse.json({ reference, text: "" });
  }

  const { text, truncated } = lookupVerse(
    bible,
    parsed.bookDisplay,
    parsed.chapter,
    parsed.startVerse,
    parsed.endVerse
  );
  if (!text) {
    devLog("[verse] miss", { reference, reason: "not-found" });
    return NextResponse.json({ reference, text: "" });
  }
  if (truncated) {
    devLog("[verse] truncated", { reference });
  } else {
    devLog("[verse] ok", { reference, chars: text.length });
  }
  return NextResponse.json({ reference, text });
}
