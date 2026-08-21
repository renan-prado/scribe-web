import { NextResponse } from "next/server";
import { AVAILABLE_TRANSLATIONS, isAvailableTranslation, loadBible } from "@/lib/bibles/loader";
import { lookupVerse } from "@/lib/bibles/lookup";
import { parseVerseReference } from "@/lib/domain/feed";
import { requireAuth } from "@/lib/supabase/require-auth";

export type { VersePayload } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TRANSLATION = "NVI";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  let body: { reference?: string; translation?: string };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const reference = (body.reference ?? "").trim();
  const requested = (body.translation ?? "").trim().toUpperCase() || DEFAULT_TRANSLATION;

  if (!reference) {
    return NextResponse.json({ error: "empty reference" }, { status: 400 });
  }

  const parsed = parseVerseReference(reference);
  if (!parsed || parsed.startVerse == null || parsed.endVerse == null) {
    return NextResponse.json({ reference, text: "", translation: requested });
  }

  // Fallback chain: requested translation → NVI. Deduped, only known files.
  const chain = [requested, DEFAULT_TRANSLATION].filter(
    (t, i, arr) => arr.indexOf(t) === i && isAvailableTranslation(t)
  );

  for (const t of chain) {
    const bible = await loadBible(t);
    if (!bible) continue;
    const { text, truncated } = lookupVerse(
      bible,
      parsed.bookDisplay,
      parsed.chapter,
      parsed.startVerse,
      parsed.endVerse
    );
    if (text) {
      if (truncated) {
        console.log("[verse] truncated", { reference, translation: t, requested });
      } else {
        console.log("[verse] ok", { reference, translation: t, requested, chars: text.length });
      }
      return NextResponse.json({ reference, text, translation: t });
    }
  }

  console.log("[verse] miss", { reference, requested, available: AVAILABLE_TRANSLATIONS });
  return NextResponse.json({ reference, text: "", translation: requested });
}
