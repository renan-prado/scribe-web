import { NextResponse } from "next/server";
import { z } from "zod";
import { loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/feed";
import { parseJsonBody } from "@/lib/http/validate";
import { createLogger } from "@/lib/log";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/supabase/require-auth";

const log = createLogger("verse");

// A verse reference like "1 Coríntios 13:1-13" is well under 100 chars.
// 200 is generous headroom without giving a bot room to smuggle a payload.
const BodySchema = z.object({ reference: z.string().max(200) }).strict();

export type { VersePayload } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSLATION = "NVI";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(request, RATE_LIMITS.verse, auth.user.id);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, BodySchema);
  if (!parsed.ok) return parsed.response;

  const reference = parsed.data.reference.trim();
  if (!reference) {
    return NextResponse.json({ error: "empty reference" }, { status: 400 });
  }

  const ref = parseVerseReference(reference);
  if (!ref || ref.startVerse == null || ref.endVerse == null) {
    return NextResponse.json({ reference, text: "" });
  }

  const bible = await loadBible(TRANSLATION);
  if (!bible) {
    log.debug("miss", { reference, reason: "translation-file-missing" });
    return NextResponse.json({ reference, text: "" });
  }

  const { text, truncated } = lookupVerse(
    bible,
    ref.bookDisplay,
    ref.chapter,
    ref.startVerse,
    ref.endVerse
  );
  if (!text) {
    log.debug("miss", { reference, reason: "not-found" });
    return NextResponse.json({ reference, text: "" });
  }
  if (truncated) {
    log.debug("truncated", { reference });
  } else {
    log.debug("ok", { reference, chars: text.length });
  }
  return NextResponse.json({ reference, text });
}
