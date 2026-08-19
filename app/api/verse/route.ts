import { NextResponse } from "next/server";
import { parseVerseFromLLM } from "@/lib/domain/verse";
import { serverEnv } from "@/lib/env/server";
import { VERSE_SYSTEM_PROMPT } from "@/lib/prompts/verse";

export type { VersePayload } from "@/lib/domain/verse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: Request) {
  const apiKey = serverEnv.OPENAI_API_KEY;
  const model = serverEnv.OPENAI_VERSE_MODEL;

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

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VERSE_SYSTEM_PROMPT },
          { role: "user", content: `referência: ${reference}` },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${raw.slice(0, 500)}` },
      { status: 502 }
    );
  }

  let parsed: { choices?: { message?: { content?: string } }[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fall through
  }
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  return NextResponse.json(parseVerseFromLLM(content, reference));
}
